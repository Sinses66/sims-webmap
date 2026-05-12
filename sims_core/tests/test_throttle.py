"""
tests/test_throttle.py — Tests du rate limiting sur /api/auth/token/
=====================================================================

Couverture :
  ✓ Une tentative valide retourne 200
  ✓ Une tentative invalide retourne 401 (et non 429)
  ✓ Après N+1 tentatives en rafale, on reçoit 429 Too Many Requests

Stratégie de test :
  - On patche LoginRateThrottle.get_rate() via mock.patch pour contrôler
    le taux indépendamment de settings.py (production ou test).
  - Pas d'@override_settings : évite les conflits avec le cache DRF.
"""

import pytest
from unittest.mock import patch
from rest_framework.test import APIClient
from django.contrib.auth.models import User

from sims_core.throttles import LoginRateThrottle

TOKEN_URL = '/api/auth/token/'


@pytest.mark.django_db
class TestLoginThrottle:

    def setup_method(self):
        """Client frais + utilisateur de test."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='throttle_test_user',
            password='ValidPass123!',
        )

    def test_connexion_valide_retourne_200(self):
        """Credentials valides → 200 + token access."""
        # Taux permissif pour ce test
        with patch.object(LoginRateThrottle, 'get_rate', return_value='100/min'):
            r = self.client.post(TOKEN_URL, {
                'username': 'throttle_test_user',
                'password': 'ValidPass123!',
            }, format='json')
        assert r.status_code == 200
        assert 'access' in r.data

    def test_mauvais_mot_de_passe_retourne_401(self):
        """Mauvais credentials → 401, pas 429."""
        with patch.object(LoginRateThrottle, 'get_rate', return_value='100/min'):
            r = self.client.post(TOKEN_URL, {
                'username': 'throttle_test_user',
                'password': 'MauvaisMotDePasse',
            }, format='json')
        assert r.status_code == 401

    def test_rafale_depasse_limite_retourne_429(self):
        """
        Avec un taux de 3/min, la 4e requête depuis la même IP → 429.
        Les 3 premières → 401 (mauvais mot de passe, throttle pas encore atteint).
        """
        payload = {
            'username': 'throttle_test_user',
            'password': 'MauvaisMotDePasse',
        }

        with patch.object(LoginRateThrottle, 'get_rate', return_value='3/min'):
            responses = []
            for _ in range(4):
                r = self.client.post(
                    TOKEN_URL, payload, format='json',
                    REMOTE_ADDR='1.2.3.4',
                )
                responses.append(r.status_code)

        assert responses[0] == 401, "1re requête : mauvais mdp → 401"
        assert responses[1] == 401, "2e requête : mauvais mdp → 401"
        assert responses[2] == 401, "3e requête : mauvais mdp → 401"
        assert responses[3] == 429, "4e requête : limite dépassée → 429"
