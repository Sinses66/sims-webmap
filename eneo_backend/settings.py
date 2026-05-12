import os
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-h)koc3(#c3t%0cyvza)$$l8%(#l&$v9wy7$w@gk)w%g&ro^wqz'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',
    'rest_framework',
    'rest_framework_gis',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    'sims_network',
    'sims_core',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'eneo_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'eneo_backend.wsgi.application'

import dj_database_url as _dj_db_url
DATABASES = {
    'default': _dj_db_url.config(
        default='postgis://eneo:eneo_pass@db:5432/eneo_sims',
        engine='django.contrib.gis.db.backends.postgis',
        conn_max_age=600,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── CORS ──────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = True

# ── REST Framework + JWT ──────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_FILTER_BACKENDS': ['django_filters.rest_framework.DjangoFilterBackend'],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_RATES': {
        'login': '5/min',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES':      ('Bearer',),
}

# ── GDAL / GEOS ───────────────────────────────────
GDAL_LIBRARY_PATH = '/usr/lib/x86_64-linux-gnu/libgdal.so'
GEOS_LIBRARY_PATH = '/usr/lib/x86_64-linux-gnu/libgeos_c.so'

# ── Documentation API ─────────────────────────────
SPECTACULAR_SETTINGS = {
    'TITLE': 'ENEO GIS API',
    'DESCRIPTION': 'API du réseau géo-électrique ENEO',
    'VERSION': '1.0.0',
    'ENUM_NAME_OVERRIDES': {
        'IncidentStatutEnum':     'sims_network.models.IncidentStatut',
        'InterventionStatutEnum': 'sims_network.models.InterventionStatut',
        'IncidentPrioriteEnum':   'sims_network.models.IncidentPriorite',
        'IncidentTypeEnum':       'sims_network.models.IncidentType',
        'TypeTravauxEnum':        'sims_network.models.TypeTravaux',
    },
}

MEDIA_URL  = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# GeoServer
GEOSERVER_URL      = os.environ.get('GEOSERVER_URL',      'http://localhost:8080/geoserver')
GEOSERVER_USER     = os.environ.get('GEOSERVER_USER',     'admin')
GEOSERVER_PASSWORD = os.environ.get('GEOSERVER_PASSWORD', 'geoserver')


# ── Thème Admin Jazzmin ───────────────────────────────────────────
import os as _os
_jazzmin_path = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), 'jazzmin_settings.py')
if _os.path.exists(_jazzmin_path):
    exec(open(_jazzmin_path).read())

# Redirection après déconnexion → page d'accueil
LOGOUT_REDIRECT_URL = '/'

# URL du portail SIMS Online (frontend React)
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
