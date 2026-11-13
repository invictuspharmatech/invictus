"""Plain-text and address-email checks shared by checkout, contact, and accounts."""

from __future__ import annotations

import html
import re
from urllib.parse import unquote

from django.conf import settings

_MARKUP = re.compile(r"[<>＜＞&＆\"'`\\{}＂＇]")
_EVENT = re.compile(
    r"\b(onerror|onload|onclick|onmouseover|onfocus|onmouseenter|onpointerdown)\s*=",
    re.IGNORECASE,
)
_JS = re.compile(r"javascript\s*:", re.IGNORECASE)
_PERSON = re.compile(r"^[A-Za-z]+(?: [A-Za-z]+)*$")

MARKUP_MESSAGE = "This field cannot include HTML, quotes, or script text."
NAME_MESSAGE = "Name can only contain letters."


def contains_markup(value: str) -> bool:
    if value == "":
        return False
    if "\0" in value:
        return True
    candidates = [value, html.unescape(value)]
    decoded = unquote(value)
    if decoded != value:
        candidates.append(decoded)
        candidates.append(html.unescape(decoded))
    for text in candidates:
        if _MARKUP.search(text) or _EVENT.search(text) or _JS.search(text):
            return True
    return False


def markup_error(*values: str) -> str | None:
    for value in values:
        if contains_markup(value or ""):
            return MARKUP_MESSAGE
    return None


def person_name_error(value: str) -> str | None:
    text = (value or "").strip()
    if text == "" or not _PERSON.fullmatch(text):
        return NAME_MESSAGE
    if contains_markup(text):
        return MARKUP_MESSAGE
    return None


def _split_emails(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip().lower() for part in re.split(r"[,;\s]+", value) if "@" in part]


def sending_addresses() -> set[str]:
    found: set[str] = set()
    for value in (
        getattr(settings, "DEFAULT_FROM_EMAIL", ""),
        getattr(settings, "ZOHO_MAIL_FROM_ADDRESS", ""),
    ):
        email = str(value or "").strip().lower()
        if "@" in email:
            found.add(email.split("<")[-1].strip(" >"))
    try:
        from cms.mailer import get_email_settings
        from cms.models import EmailTemplate

        row = get_email_settings()
        for value in (row.from_email, row.bulk_from_email, row.extra_admin_emails, row.warehouse_1_emails, row.warehouse_2_emails):
            found.update(_split_emails(value))
        for custom in EmailTemplate.objects.values_list("custom_emails", flat=True):
            found.update(_split_emails(custom))
    except Exception:
        pass
    return found


def address_email_rejection(given: str | None, user=None, account_email: str | None = None) -> str | None:
    from accounts.models import User

    given_norm = (given or "").strip().lower()
    account = (account_email if account_email is not None else (getattr(user, "email", "") or "")).strip().lower()
    if given_norm == "" or (account and given_norm == account):
        return None
    others = User.objects.filter(email__iexact=given_norm)
    if user is not None and getattr(user, "pk", None):
        others = others.exclude(pk=user.pk)
    if others.exists() or given_norm in sending_addresses():
        return "This email already belongs to an account and cannot be saved here."
    if account:
        return "The address email must be the same as the account email."
    return None
