"""Contact-form IP blocks after repeated HTML/script submissions."""

from __future__ import annotations

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from accounts.client_ip import client_ip
from accounts.cloudflare_blocks import queue_enforce, queue_lift
from cms.ops_settings import get_json, save_json
from orders.models import ContactIpBlock

STRIKES_BEFORE_BLOCK = 3
SETTING_KEY = "security.contact_ip_ban"
SETTING_LABEL = "Contact form IP ban"
SETTING_GROUP = "security"
DEFAULT_POLICY = {"autoExpire": True, "minutes": 30}
MIN_BAN_MINUTES = 1
MAX_BAN_MINUTES = 60 * 24 * 30  # 30 days
CHAR_GUIDE = (
    "Do not use HTML or script characters such as < or >. "
    "Plain text only (apostrophes, ?, !, and quotes are fine)."
)


def ban_policy() -> dict:
    raw = get_json(SETTING_KEY, DEFAULT_POLICY)
    if not isinstance(raw, dict):
        raw = DEFAULT_POLICY
    auto_expire = bool(raw.get("autoExpire", True))
    try:
        minutes = int(raw.get("minutes") or DEFAULT_POLICY["minutes"])
    except (TypeError, ValueError):
        minutes = int(DEFAULT_POLICY["minutes"])
    minutes = max(MIN_BAN_MINUTES, min(MAX_BAN_MINUTES, minutes))
    return {"autoExpire": auto_expire, "minutes": minutes}


def save_ban_policy(auto_expire: bool, minutes: int) -> dict:
    try:
        mins = int(minutes)
    except (TypeError, ValueError):
        mins = int(DEFAULT_POLICY["minutes"])
    mins = max(MIN_BAN_MINUTES, min(MAX_BAN_MINUTES, mins))
    payload = {"autoExpire": bool(auto_expire), "minutes": mins}
    save_json(SETTING_KEY, payload, SETTING_LABEL, SETTING_GROUP)
    return payload


def block_message(minutes: int | None) -> str:
    if minutes is None:
        return (
            "This network is blocked from the contact form until staff remove the block. "
            "Remove HTML characters such as < or > before trying again."
        )
    return (
        f"This network is blocked from the contact form for {minutes} minutes. "
        "Remove HTML characters such as < or > and try again after the block ends."
    )


def duration_phrase(minutes: int | None) -> str:
    if minutes is None:
        return "until staff remove the block"
    return f"for {minutes} minutes"


def policy_minutes_or_none() -> int | None:
    policy = ban_policy()
    return policy["minutes"] if policy["autoExpire"] else None


def compute_expires_at(blocked_at, minutes: int | None):
    if blocked_at is None or minutes is None:
        return None
    return blocked_at + timedelta(minutes=minutes)


def row_ban_minutes(row: ContactIpBlock) -> int | None:
    """Minutes for an active ban snapshot; None = permanent."""
    if row.blocked_at is None:
        return None
    until = getattr(row, "block_expires_at", None)
    if until is None:
        # Legacy rows without snapshot: honor current policy.
        return policy_minutes_or_none()
    return max(1, int(round((until - row.blocked_at).total_seconds() / 60)))


def expires_at(row: ContactIpBlock):
    """Prefer the snapshot on the row; fall back to current policy for legacy rows."""
    stored = getattr(row, "block_expires_at", None)
    if row.blocked_at is None:
        return None
    if stored is not None:
        return stored
    # Legacy: no snapshot field value — use current policy (None = treat as permanent).
    return compute_expires_at(row.blocked_at, policy_minutes_or_none())


def _clear_expired(row: ContactIpBlock) -> bool:
    """Clear an expired timed block. Returns True if still actively blocked."""
    if row.blocked_at is None:
        return False
    until = expires_at(row)
    if until is None:
        return True  # permanent until manual remove
    if timezone.now() < until:
        return True
    rule_id = row.cloudflare_rule_id if isinstance(row.cloudflare_rule_id, str) else None
    ip = row.ip_address
    row.blocked_at = None
    row.block_expires_at = None
    row.rejected_count = 0
    row.cloudflare_rule_id = None
    row.save(
        update_fields=["blocked_at", "block_expires_at", "rejected_count", "cloudflare_rule_id", "updated_at"]
    )
    queue_lift(ip, rule_id)
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
    until = expires_at(row)
    if until is None:
        return None
    return max(0, int((until - timezone.now()).total_seconds()))


def note_rejection(request) -> dict:
    """Strike 1–2: warn. Strike 3+: ban (timed or permanent per admin policy)."""
    minutes = policy_minutes_or_none()
    policy = ban_policy()
    ip = client_ip(request)
    if not ip:
        return {
            "strikes": 0,
            "blocked": False,
            "blockMinutes": minutes,
            "autoExpire": policy["autoExpire"],
            "message": CHAR_GUIDE,
        }

    newly_blocked = False
    with transaction.atomic():
        row = ContactIpBlock.objects.select_for_update().filter(ip_address=ip).first()
        if row is None:
            row = ContactIpBlock.objects.create(ip_address=ip, rejected_count=1, blocked_at=None)
        elif row.blocked_at is not None and _clear_expired(row):
            until = expires_at(row)
            return {
                "strikes": int(row.rejected_count or 0),
                "blocked": True,
                "blockMinutes": row_ban_minutes(row),
                "autoExpire": until is not None,
                "blockedUntil": until.isoformat() if until else None,
                "message": block_message(row_ban_minutes(row)),
            }
        else:
            row.rejected_count = int(row.rejected_count or 0) + 1
            if row.rejected_count >= STRIKES_BEFORE_BLOCK and row.blocked_at is None:
                now = timezone.now()
                row.blocked_at = now
                row.block_expires_at = compute_expires_at(now, minutes)
                newly_blocked = True
            row.save(
                update_fields=["rejected_count", "blocked_at", "block_expires_at", "updated_at"]
            )

        strikes = int(row.rejected_count or 0)
        blocked = row.blocked_at is not None
        until = expires_at(row) if blocked else None
        ban_mins = row_ban_minutes(row) if blocked else minutes
        if blocked:
            message = block_message(ban_mins)
        elif strikes >= 2:
            message = (
                f"{CHAR_GUIDE} Final warning: one more attempt will block this network "
                f"{duration_phrase(minutes)}."
            )
        else:
            message = (
                f"{CHAR_GUIDE} Warning {strikes} of {STRIKES_BEFORE_BLOCK - 1} — "
                f"a third attempt will block this network {duration_phrase(minutes)}."
            )
        result = {
            "strikes": strikes,
            "blocked": blocked,
            "blockMinutes": ban_mins if blocked else minutes,
            "autoExpire": policy["autoExpire"],
            "blockedUntil": until.isoformat() if until else None,
            "message": message,
        }

    if newly_blocked:
        queue_enforce(ip)
    return result


def active_blocked_rows():
    """Rows still blocked (expires timed rows; permanent stay until manual remove)."""
    rows = list(ContactIpBlock.objects.filter(blocked_at__isnull=False).order_by("-blocked_at"))
    active = []
    for row in rows:
        if _clear_expired(row):
            active.append(row)
    return active
