"""
sims_core/throttles.py
======================
Throttle classes pour protéger les endpoints sensibles.

LoginRateThrottle
  - Scope : 'login'
  - Taux : 5 tentatives/minute par IP (configurable dans settings.py)
  - Applicable sur : TokenObtainPairView (POST /api/auth/token/)

CreateRateThrottle
  - Scope : 'create'
  - Taux : 60 créations/minute par utilisateur authentifié (configurable)
  - Applicable sur : IncidentViewSet, InterventionViewSet (action create)

Usage dans urls.py :
    from sims_core.throttles import ThrottledTokenObtainPairView
    path('api/auth/token/', ThrottledTokenObtainPairView.as_view(), ...)

Usage dans un ViewSet :
    from sims_core.throttles import CreateRateThrottle
    def get_throttles(self):
        if self.action == 'create':
            return [CreateRateThrottle()]
        return super().get_throttles()
"""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from rest_framework.settings import api_settings as drf_api_settings
from rest_framework_simplejwt.views import TokenObtainPairView


# ── Taux par défaut (fallback si absents de settings.py) ──────────
_DEFAULT_LOGIN_RATE  = '5/min'
_DEFAULT_CREATE_RATE = '60/min'


class LoginRateThrottle(AnonRateThrottle):
    """
    Limite les tentatives de connexion par IP.

    Priorité du taux appliqué :
      1. settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['login']  (si défini)
      2. _DEFAULT_LOGIN_RATE = '5/min'  (fallback)
    """
    scope = 'login'

    def get_rate(self):
        rates = drf_api_settings.DEFAULT_THROTTLE_RATES or {}
        return rates.get(self.scope, _DEFAULT_LOGIN_RATE)


class CreateRateThrottle(UserRateThrottle):
    """
    Limite les créations (POST) par utilisateur authentifié.

    Protège les endpoints /api/incidents/ et /api/interventions/
    contre les soumissions abusives.

    Priorité du taux appliqué :
      1. settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['create']  (si défini)
      2. _DEFAULT_CREATE_RATE = '60/min'  (fallback)
    """
    scope = 'create'

    def get_rate(self):
        rates = drf_api_settings.DEFAULT_THROTTLE_RATES or {}
        return rates.get(self.scope, _DEFAULT_CREATE_RATE)


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """
    Vue JWT d'obtention de token avec rate limiting intégré.
    Remplace TokenObtainPairView dans urls.py.
    """
    throttle_classes = [LoginRateThrottle]
