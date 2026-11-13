"""Email verification links expire in 15 minutes. Two sends, then an admin must activate."""

from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import timedelta

from django.utils import timezone

from accounts.models import EmailVerificationToken, User

logger = logging.getLogger(__name__)

EXPIRES_MINUTES = 15
MAX_SENDS = 2


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _open(record: EmailVerificationToken | None) -> bool:
    if record is None:
        return False
    return record.created_at + timedelta(minutes=EXPIRES_MINUTES) > timezone.now()


def login_gate(user: User) -> str:
    record = EmailVerificationToken.objects.filter(email__iexact=user.email).first()
    if _open(record):
        return "pending"
    if int(user.email_verification_sends or 0) >= MAX_SENDS:
        return "locked"
    return "resend"


def _deliver(user: User, url: str) -> bool:
    from cms.mailer import ensure_default_templates, get_email_settings, mail_channel_ready, render_tokens, resolve_recipients, send_message

    try:
        ensure_default_templates()
        settings_row = get_email_settings()
        if not mail_channel_ready(settings_row, "transactional"):
            return False
        from cms.models import EmailTemplate

        template = EmailTemplate.objects.filter(event_key="email_verification", enabled=True).first()
        if not template:
            return False
        context = {
            "site_name": "Invictus Pharma",
            "user_name": user.name or user.email,
            "user_email": user.email,
            "verification_url": url,
            "expires_minutes": EXPIRES_MINUTES,
        }
        recipients = resolve_recipients(template, settings_row, user_email=user.email)
        if not recipients:
            return False
        send_message(
            settings_row,
            to=recipients,
            subject=render_tokens(template.subject, context),
            html_body=render_tokens(template.body, context),
            channel="transactional",
        )
        return True
    except Exception:
        logger.exception("Verification email failed for %s", user.email)
        return False


def send(user: User) -> bool:
    from django.conf import settings

    if int(user.email_verification_sends or 0) >= MAX_SENDS:
        return False
    record = EmailVerificationToken.objects.filter(email__iexact=user.email).first()
    if _open(record):
        return False
    token = secrets.token_urlsafe(32)
    EmailVerificationToken.objects.update_or_create(
        email=user.email.lower(),
        defaults={"token_hash": _hash(token), "created_at": timezone.now()},
    )
    base = (getattr(settings, "PUBLIC_SITE_URL", "") or "http://localhost:3000").rstrip("/")
    url = f"{base}/verify-email?token={token}&email={user.email}"
    if not _deliver(user, url):
        EmailVerificationToken.objects.filter(email__iexact=user.email).delete()
        return False
    user.email_verification_sends = int(user.email_verification_sends or 0) + 1
    user.save(update_fields=["email_verification_sends"])
    return True


def consume(token: str, email: str) -> str:
    email = (email or "").strip().lower()
    record = EmailVerificationToken.objects.filter(email__iexact=email).first()
    user = User.objects.filter(email__iexact=email).first()
    if user and user.email_verified_at and user.is_active:
        return "verified"
    if user and user.email_verified_at and not user.is_active:
        return "inactive"
    if not record or not token or _hash(token) != record.token_hash:
        return "invalid"
    if not _open(record):
        record.delete()
        return "expired"
    if not user:
        return "invalid"
    user.is_active = True
    user.email_verified_at = timezone.now()
    user.save(update_fields=["is_active", "email_verified_at"])
    return "verified"
