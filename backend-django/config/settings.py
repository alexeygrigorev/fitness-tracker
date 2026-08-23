import os
from pathlib import Path
from datetime import timedelta
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'local-secret')
DEBUG = os.environ.get('DEBUG', 'true').lower() == 'true'

_allowed_hosts = os.environ.get(
    'DJANGO_ALLOWED_HOSTS',
    os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1'),
)
ALLOWED_HOSTS = [host.strip() for host in _allowed_hosts.split(',') if host.strip()]

if not DEBUG and SECRET_KEY == 'local-secret':
    raise ImproperlyConfigured('SECRET_KEY must be set when DEBUG is disabled')

if not DEBUG and len(SECRET_KEY) < 50:
    raise ImproperlyConfigured('SECRET_KEY must contain at least 50 characters')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'drf_spectacular',
    'rest_framework_simplejwt',
    'corsheaders',
    'config',
    'users',
    'workouts',
    'food',
    'ai',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        # Configure via DB_PATH env var, defaults to BASE_DIR / 'db.sqlite3'
        # Docker: set DB_PATH=/app/backend/db/db.sqlite3 for persistent volume
        'NAME': Path(os.environ.get('DB_PATH', BASE_DIR / 'db.sqlite3')),
        # Gunicorn runs several request threads against one SQLite file. WAL and
        # an explicit busy timeout prevent transient writer contention from
        # surfacing as failed requests during bursts.
        'OPTIONS': {
            'init_command': (
                'PRAGMA journal_mode=WAL;'
                'PRAGMA synchronous=NORMAL;'
                'PRAGMA busy_timeout=10000;'
            ),
            'timeout': 10,
            'transaction_mode': 'IMMEDIATE',
        },
    }
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
STATIC_ROOT = Path(os.environ.get('STATIC_ROOT', BASE_DIR / 'staticfiles'))

# Frontend static files (React build)
# Only served when SERVE_FRONTEND env var is explicitly set to 'true'
# In dev mode, frontend runs separately on Vite dev server
# In Docker/production, set SERVE_FRONTEND=true to enable frontend serving
SERVE_FRONTEND = os.environ.get('SERVE_FRONTEND', 'false').lower() == 'true'
FRONTEND_BUILD = None
if SERVE_FRONTEND:
    _frontend_build_path = BASE_DIR.parent / 'web' / 'dist'
    FRONTEND_BUILD = _frontend_build_path if _frontend_build_path.exists() else None

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'users.User'

if not DEBUG:
    # A portable image cannot know whether its network terminates TLS, so
    # proxy trust is an explicit per-deployment decision.
    trust_proxy_tls = os.environ.get('DJANGO_TRUST_PROXY_TLS', 'false').lower() == 'true'
    if trust_proxy_tls:
        SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = trust_proxy_tls
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    CSRF_TRUSTED_ORIGINS = [
        origin.strip()
        for origin in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',')
        if origin.strip()
    ]
    SECURE_REFERRER_POLICY = 'same-origin'
    SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'
    X_FRAME_OPTIONS = 'DENY'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

SIMPLE_JWT = {
    'AUTH_HEADER_TYPES': ('Bearer',),
    'ACCESS_TOKEN_LIFETIME': timedelta(days=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=60),
}

# Local E2E runs may bind Vite to an arbitrary free port.
frontend_url = os.environ.get('FRONTEND_URL')
if DEBUG:
    default_cors_origins = [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
    ]
    if frontend_url:
        default_cors_origins.append(frontend_url.rstrip('/'))
    CORS_ALLOWED_ORIGINS = default_cors_origins
else:
    # Production serves the browser app from the same origin, so cross-origin
    # access is opt-in via FRONTEND_URL instead of allowing localhost origins.
    CORS_ALLOWED_ORIGINS = [frontend_url.rstrip('/')] if frontend_url else []

CORS_ALLOW_CREDENTIALS = False

# drf-spectacular settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'Fitness Tracker API',
    'DESCRIPTION': 'API for tracking workouts, exercises, and nutrition',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SCHEMA_PATH_PREFIX': '/api',
    'COMPONENT_SPLIT_REQUEST': True,
    'DISABLE_ERRORS_AND_WARNINGS': True,
}
