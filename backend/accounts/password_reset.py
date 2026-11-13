"""Signed password-reset tokens (no DB table).

Tokens bind to the current password hash fingerprint so they stop working
after a successful reset (or any password change).
"""

from __future__ import annotations

import hashlib
import time

from django.conf import settings

from accounts import hs256
from accounts.models import User

PURPOSE = "password_reset"
DEFAULT_TTL_SECONDS = 15 * 60


def _fingerprint(user: User) -> str:
    raw = user.password or ""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def issue_reset_token(user: User, *, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> str:
    now = int(time.time())
    payload = {
        "purpose": PURPOSE,
        "uid": str(user.id),
        "email": user.email,
        "ph": _fingerprint(user),
        "iat": now,
        "exp": now + max(300, int(ttl_seconds)),
    }
    return hs256.encode(payload, settings.AUTH_SECRET, algorithm="HS256")


def verify_reset_token(token: str) -> User | None:
    token = (token or "").strip()
    if not token:
        return None
    try:
        payload = hs256.decode(token, settings.AUTH_SECRET, algorithms=["HS256"])
    except hs256.TokenError:
        return None
    if payload.get("purpose") != PURPOSE:
        return None
    uid = str(payload.get("uid") or "")
    email = str(payload.get("email") or "").strip().lower()
    ph = str(payload.get("ph") or "")
    if not uid or not email or not ph:
        return None
    user = User.objects.filter(pk=uid, email=email, is_active=True).first()
    if not user:
        return None
    if ph != _fingerprint(user):
        return None
    return user


def reset_url_for(user: User, *, token: str | None = None) -> str:
    base = (getattr(settings, "PUBLIC_SITE_URL", "") or "http://localhost:3000").rstrip("/")
    value = token or issue_reset_token(user)
    return f"{base}/reset-password?token={value}"
