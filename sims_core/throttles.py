"""
sims_core/throttles.py
======================
Throttle classes pour protéger les endpoints sensibles.

LoginRateThrottle
  - Scope : 'login'
  - Taux configuré dans settings.py → REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
  - Exemple : '5/min'  (5 tentatives par minute par IP)
  - Applicable sur : TokenObtainPairView (POST /api/auth/token/)

Le throttling est basé sur l'IP du client (AnonRateThrottle).
Même un utilisateur authentifié avec un token valide est limité
car cette vue sert à obtenir de nouveaux tokens.

Usage dans urls.py :
    from sims_core.throttles import ThrottledTokenObtainPairView
    path('api/auth/token/', ThrottledTokenObtainPairView.as_view(), ...)
"""

from rest_framework.throttling import AnonRateThrottle
from rest_framework.settings import api_settings as drf_api_settings
from rest_framework_simplejwt.views import TokenObtainPairView


# Taux appliqué si 'login' est absent de DEFAULT_THROTTLE_RATES dans settings.py.
# Permet au throttle de fonctionner sans configuration explicite (fail-safe).
_DEFAULT_LOGIN_RATE = '5/min'


class LoginRateThrottle(AnonRateThrottle):
    """
    Limite les tentatives de connexion par IP.

    Priorité du taux appliqué :
      1. settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['login']  (si défini)
      2. _DEFAULT_LOGIN_RATE = '5/min'  (fallback)

    Le fallback garantit qu'aucune ImproperlyConfigured n'est levée même si
    DEFAULT_THROTTLE_RATES n'est pas configuré dans settings.py.
    """
    scope = 'login'

    def get_rate(self):
        """Lit le taux depuis api_settings avec fallback sur _DEFAULT_LOGIN_RATE."""
        rates = drf_api_settings.DEFAULT_THROTTLE_RATES or {}
        return rates.get(self.scope, _DEFAULT_LOGIN_RATE)


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """
    Vue JWT d'obtention de token avec rate limiting intégré.
    Remplace TokenObtainPairView dans urls.py.
    """
    throttle_classes = [LoginRateThrottle]
