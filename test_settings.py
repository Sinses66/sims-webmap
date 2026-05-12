"""
test_settings.py — Configuration Django minimale pour pytest
============================================================
Utilise SQLite en mémoire pour des tests rapides et isolés.
Aucune dépendance PostGIS / GeoServer n'est nécessaire ici :
les modèles Incident / Intervention n'ont pas de champ géométrique.

Usage : pytest --ds=test_settings   ou via pytest.ini
"""

SECRET_KEY = "sims-test-secret-key-not-for-production"
DEBUG = True
ROOT_URLCONF = "test_urls"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "rest_framework",
    "rest_framework_simplejwt",
    "sims_network",
    "sims_core",
]

# Nécessaire pour django.contrib.auth
AUTH_PASSWORD_VALIDATORS = []

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# DRF minimal
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # SessionAuthentication retiré : renvoie 403 pour anonyme (pas de WWW-Authenticate).
        # JWTAuthentication seul → 401 cohérent avec les assertions des tests.
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    # Throttling — taux de base pour les tests (surchargé par @override_settings si besoin)
    "DEFAULT_THROTTLE_RATES": {
        "login": "100/min",   # permissif en tests sauf test dédié 429
    },
}

# Pas de cache réel en tests
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}

# Médias (non utilisé en tests, mais évite les erreurs d'import)
MEDIA_URL = "/media/"
MEDIA_ROOT = "/tmp/sims_test_media"

USE_TZ = True
TIME_ZONE = "UTC"
