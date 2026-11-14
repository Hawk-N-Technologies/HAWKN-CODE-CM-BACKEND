"""
Django settings for the AMPL Packing POC backend.

All secrets and environment-specific values come from environment variables
(or AMPL_Packing_POC/.env during local development). See .env.example.
"""
from pathlib import Path
from urllib.parse import unquote, urlparse

from .env import env_bool, env_int, env_list, env_str, load_env_file

BASE_DIR = Path(__file__).resolve().parent.parent
load_env_file(BASE_DIR / ".env")

# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------
SECRET_KEY = env_str(
    "DJANGO_SECRET_KEY", "django-insecure-ampl-poc-key-change-in-production"
)
DEBUG = env_bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env_list(
    "DJANGO_ALLOWED_HOSTS",
    "ampl-pocapi.hawkntechnologies.com,ampl-poc.hawkntechnologies.com,localhost,127.0.0.1,testserver",
)
CSRF_TRUSTED_ORIGINS = env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "https://ampl-poc.hawkntechnologies.com,https://ampl-pocapi.hawkntechnologies.com,http://localhost:5180,http://127.0.0.1:5180,http://localhost:18000,http://127.0.0.1:18000",
)

APP_NAME = "AMPL Packing POC"
APP_VERSION = "0.1.0"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "apps.common",
    "apps.accounts",
    "apps.catalog",
    "apps.packing",
    "apps.labels",
    "apps.reports",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# CORS (Cross-Origin Resource Sharing)
# Needed because frontend (ampl-poc) and backend (ampl-pocapi) are separate domains.
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    "https://ampl-poc.hawkntechnologies.com,http://localhost:5180,http://127.0.0.1:5180",
)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = env_bool("DJANGO_CORS_ALLOW_ALL", default=False)

# ---------------------------------------------------------------------------
# Database: PostgreSQL database `ampl-poc`.
# Supports DATABASE_URL or individual DB_* environment variables.
# ---------------------------------------------------------------------------
_db_url = env_str("DATABASE_URL", "")
if _db_url:
    _parsed = urlparse(_db_url)
    _default_db_user = unquote(_parsed.username or "")
    _default_db_password = unquote(_parsed.password or "")
    _default_db_host = _parsed.hostname or "194.164.148.10"
    _default_db_port = str(_parsed.port or 17999)
    _default_db_name = unquote(_parsed.path.lstrip("/") or "ampl-poc")
else:
    _default_db_user = "pocampl"
    _default_db_password = "UBSMhLfgnOeDKeWi6BzH"
    _default_db_host = "194.164.148.10"
    _default_db_port = "17999"
    _default_db_name = "ampl-poc"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env_str("DB_NAME", _default_db_name),
        "USER": env_str("DB_USER", _default_db_user),
        "PASSWORD": env_str("DB_PASSWORD", _default_db_password),
        "HOST": env_str("DB_HOST", _default_db_host),
        "PORT": env_str("DB_PORT", _default_db_port),
        # 0 = close after each request. Required with runserver (one thread per request);
        # set DB_CONN_MAX_AGE=60 on the server (gunicorn) to reuse connections.
        "CONN_MAX_AGE": env_int("DB_CONN_MAX_AGE", 0),
        "CONN_HEALTH_CHECKS": True,
        "OPTIONS": {"connect_timeout": env_int("DB_CONNECT_TIMEOUT", 5)},
        "TEST": {"NAME": env_str("DB_TEST_NAME", "test_ampl_poc")},
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Reuse the prepared test database (see apps/common/test_runner.py).
TEST_RUNNER = "apps.common.test_runner.KeepDbTestRunner"

# ---------------------------------------------------------------------------
# Auth: custom user model is set from day one (cannot be changed later).
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Cookie names are prefixed so they never clash with HawkN OS cookies
# (HawkN OS uses `access_token`).
SESSION_COOKIE_NAME = "ampl_sessionid"
CSRF_COOKIE_NAME = "ampl_csrftoken"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = env_str("DJANGO_SESSION_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = env_str("DJANGO_CSRF_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_DOMAIN = env_str("DJANGO_SESSION_COOKIE_DOMAIN", "") or None
CSRF_COOKIE_DOMAIN = env_str("DJANGO_CSRF_COOKIE_DOMAIN", "") or None
COOKIE_SECURE = env_bool("DJANGO_COOKIE_SECURE", default=not DEBUG)
SESSION_COOKIE_SECURE = COOKIE_SECURE
CSRF_COOKIE_SECURE = COOKIE_SECURE
SESSION_COOKIE_AGE = env_int("SESSION_COOKIE_AGE_SECONDS", 60 * 60 * 12)

# Set to true only when running behind an HTTPS reverse proxy (nginx).
if env_bool("DJANGO_BEHIND_HTTPS_PROXY", default=False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"

# Production HTTPS hardening (all off by default for local development).
# See docs/production.env.example and docs/DEPLOYMENT.md.
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", default=False)
SECURE_HSTS_SECONDS = env_int("DJANGO_HSTS_SECONDS", 0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("DJANGO_HSTS_INCLUDE_SUBDOMAINS", default=False)
# HSTS "preload" is a decision for the whole hawkntechnologies.com domain,
# not for this one sub-site, so its deploy-check warning is silenced.
SILENCED_SYSTEM_CHECKS = ["security.W021"]

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        # Session cookie login; answers 401 when not logged in.
        "apps.accounts.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"]
    + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "EXCEPTION_HANDLER": "apps.common.exceptions.api_exception_handler",
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.StandardPagination",
    "PAGE_SIZE": 25,
}

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = env_str("DJANGO_TIME_ZONE", "Asia/Kolkata")
USE_I18N = True
USE_TZ = True

# ---------------------------------------------------------------------------
# Static files (Django admin assets)
# ---------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# ---------------------------------------------------------------------------
# Logging: one line per event on the console.
# ---------------------------------------------------------------------------
LOG_LEVEL = env_str("DJANGO_LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "simple"},
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.db.backends": {"level": "WARNING"},
    },
}
