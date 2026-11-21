"""Temporary contact-form IP blocks after repeated HTML/script submissions."""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from accounts.client_ip import client_ip
from accounts.cloudflare_blocks import queue_lift
from orders.models import ContactIpBlock

STRIKES_BEFORE_BLOCK = 3
BLOCK_MINUTES = 30
BLOCK_MESSAGE = (
    f"This network is blocked from the contact form for {BLOCK_MINUTES} minutes. "
    "Remove HTML characters such as < or > and try again after the block ends."
)
CHAR_GUIDE = "Do not use HTML or script characters such as < or >. Plain text only (apostrophes, ?, !, and quotes are fine)."


def expires_at(blocked_at):
    if blocked_at is None:
        return None
    return blocked_at + timedelta(minutes=BLOCK_MINUTES)


def _clear_expired(row: ContactIpBlock) -> bool:
    """Clear an expired block. Returns True if the row was still actively blocked."""
    if row.blocked_at is None:
        return False
    if timezone.now() < expires_at(row.blocked_at):
        return True
    rule_id = row.cloudflare_rule_id
    ip = row.ip_address
    row.blocked_at = None
    row.rejected_count = 0
    row.cloudflare_rule_id = None
    row.save(update_fields=["blocked_at", "rejected_count", "cloudflare_rule_id", "updated_at"])
    if rule_id:
        queue_lift(ip, rule_id if isinstance(rule_id, str) else None)
    return False


def is_blocked(request) -> bool:
    ip = client_ip(request)
    if not ip:
        return False
    row = ContactIpBlock.objects.filter(ip_address=ip).first()
    if row is None:
        return False
    return _clear_expired(row) if row.blocked_at else False


def remaining_block_seconds(request) -> int | None:
    ip = client_ip(request)
    if not ip:
        return None
    row = ContactIpBlock.objects.filter(ip_address=ip, blocked_at__isnull=False).first()
    if row is None:
        return None
    if not _clear_expired(row):
        return None
    expires = expires_at(row.blocked_at)
    if expires is None:
        return None
    return max(0, int((expires - timezone.now()).total_seconds()))


def note_rejection(request) -> dict:
    """
    Record a rejected contact submit.
    Strike 1–2: warn. Strike 3+: 30-minute block.
    """
    ip = client_ip(request)
    if not ip:
        return {
            "strikes": 0,
            "blocked": False,
            "blockMinutes": BLOCK_MINUTES,
            "message": CHAR_GUIDE,
        }

    with transaction.atomic():
        row = ContactIpBlock.objects.select_for_update().filter(ip_address=ip).first()
        if row is None:
            row = ContactIpBlock.objects.create(ip_address=ip, rejected_count=1, blocked_at=None)
        else:
            if row.blocked_at is not None and _clear_expired(row):
                return {
                    "strikes": int(row.rejected_count or 0),
                    "blocked": True,
                    "blockMinutes": BLOCK_MINUTES,
                    "blockedUntil": expires_at(row.blocked_at).isoformat() if row.blocked_at else None,
                    "message": BLOCK_MESSAGE,
                }
            row.rejected_count = int(row.rejected_count or 0) + 1
            if row.rejected_count >= STRIKES_BEFORE_BLOCK:
                row.blocked_at = timezone.now()
            row.save(update_fields=["rejected_count", "blocked_at", "updated_at"])

        strikes = int(row.rejected_count or 0)
        blocked = row.blocked_at is not None
        if blocked:
            message = BLOCK_MESSAGE
        elif strikes >= 2:
            message = (
                f"{CHAR_GUIDE} Final warning: one more attempt will block this network "
                f"for {BLOCK_MINUTES} minutes."
            )
        else:
            message = (
                f"{CHAR_GUIDE} Warning {strikes} of {STRIKES_BEFORE_BLOCK - 1} — "
                f"a third attempt will block this network for {BLOCK_MINUTES} minutes."
            )
        return {
            "strikes": strikes,
            "blocked": blocked,
            "blockMinutes": BLOCK_MINUTES,
            "blockedUntil": expires_at(row.blocked_at).isoformat() if row.blocked_at else None,
            "message": message,
        }


def active_blocked_rows():
    """Rows still within the temporary block window (expires stale rows)."""
    rows = list(ContactIpBlock.objects.filter(blocked_at__isnull=False).order_by("-blocked_at"))
    active = []
    for row in rows:
        if _clear_expired(row):
            active.append(row)
    return active
