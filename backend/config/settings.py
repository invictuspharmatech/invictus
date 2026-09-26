from pathlib import Path
import os

import pymysql

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

pymysql.install_as_MySQLdb()

BASE_DIR = Path(__file__).resolve().parent.parent
if load_dotenv:
    load_dotenv(BASE_DIR / ".env")
    load_dotenv(BASE_DIR.parent / ".env")


def env_first(*keys: str, default: str = "") -> str:
    for key in keys:
        value = os.environ.get(key)
        if value is not None and value != "":
            return value
    return default


SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY",
    "django-insecure-invictus-dev-only-change-in-production",
)
AUTH_SECRET = os.environ.get(
    "AUTH_SECRET",
    "invictus-pharma-dev-secret-change-in-production",
)

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]
DJANGO_ADMIN_PATH = os.environ.get("DJANGO_ADMIN_PATH", "admin").strip("/") + "/"
PUBLIC_SITE_URL = os.environ.get("PUBLIC_SITE_URL", "http://localhost:3000").rstrip("/")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "accounts",
    "catalog",
    "orders",
    "cms",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": env_first("MYSQL_DATABASE", "DB_NAME", default="invictuspharma"),
        "USER": env_first("MYSQL_USER", "DB_USER", default="root"),
        "PASSWORD": env_first("MYSQL_PASSWORD", "DB_PASSWORD", default=""),
        "HOST": env_first("MYSQL_HOST", "DB_HOST", default="127.0.0.1"),
        "PORT": env_first("MYSQL_PORT", "DB_PORT", default="3306"),
        "OPTIONS": {
            "charset": "utf8mb4",
            "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = []

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = Path(os.environ.get("STATIC_ROOT", BASE_DIR / "staticfiles"))
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", BASE_DIR / "media"))

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "0") == "1"
if COOKIE_SECURE:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SAMESITE = "Lax"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

_default_cors = "http://localhost:3000,http://127.0.0.1:3000"
if PUBLIC_SITE_URL:
    _default_cors = f"{_default_cors},{PUBLIC_SITE_URL}"
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", _default_cors).split(",")
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "accounts.authentication.InvictusJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
}

MIN_ORDER_USD = 100
SHIPPING_USD = 20
FIRST_ORDER_AFFILIATE_DISCOUNT = 0.1
JWT_TTL_SECONDS = 60 * 60 * 24 * 14
