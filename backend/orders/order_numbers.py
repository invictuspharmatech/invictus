from __future__ import annotations

import re

from django.db import transaction
from django.utils import timezone

from cms.models import SiteSetting
from cms.ops_settings import get_json, save_json

CONFIG_KEY = "order_numbering"


def to_base36(number: int) -> str:
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    if number == 0:
        return "0"
    digits = []
    value = int(number)
    while value:
        value, remainder = divmod(value, 36)
        digits.append(chars[remainder])
    return "".join(reversed(digits))


def get_order_numbering() -> dict:
    raw = get_json(CONFIG_KEY, {}) or {}
    if not isinstance(raw, dict):
        raw = {}
    digits = _int(raw.get("numDigits", raw.get("num_digits")), 5)
    digits = min(12, max(1, digits))
    prefix = _clean_prefix(raw.get("prefix", "INV"))
    return {
        "enabled": bool(raw.get("enabled", False)),
        "prefix": prefix,
        "numDigits": digits,
    }


def save_order_numbering(payload: dict) -> dict:
    data = payload or {}
    saved = {
        "enabled": bool(data.get("enabled", False)),
        "prefix": _clean_prefix(data.get("prefix", "INV")),
        "numDigits": min(12, max(1, _int(data.get("numDigits", data.get("num_digits")), 5))),
    }
    save_json(CONFIG_KEY, saved, "Sequential order numbers", "orders")
    return saved


def preview_order_number(config: dict | None = None) -> str:
    cfg = config or get_order_numbering()
    if not cfg["enabled"]:
        return "INV-XXXXXXXX-W1"
    year = timezone.now().year
    return f"{cfg['prefix']}{year}{'1'.zfill(cfg['numDigits'])}-W1"


def allocate_group_id() -> str:
    cfg = get_order_numbering()
    if not cfg["enabled"]:
        return f"INV-{to_base36(int(timezone.now().timestamp() * 1000))}"
    year = int(timezone.now().strftime("%Y"))
    seq = _allocate_sequence(cfg["prefix"], year)
    max_n = (10 ** cfg["numDigits"]) - 1
    if seq > max_n:
        raise ValueError(
            f"Order sequence exceeds {cfg['numDigits']} digit(s) for {year}. Increase digit width in settings."
        )
    return f"{cfg['prefix']}{year}{str(seq).zfill(cfg['numDigits'])}"


def _allocate_sequence(prefix: str, year: int) -> int:
    scope_key = f"order_numbering.seq.{prefix}|{year}"[:80]
    with transaction.atomic():
        row, created = SiteSetting.objects.select_for_update().get_or_create(
            key=scope_key,
            defaults={
                "value": "1",
                "label": f"Order sequence {prefix} {year}",
                "group": "order_numbering",
            },
        )
        if created:
            return 1
        seq = _int(row.value, 0) + 1
        row.value = str(seq)
        row.save(update_fields=["value"])
        return seq


def _clean_prefix(value) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]", "", str(value or "").strip())
    return (cleaned or "INV")[:32]


def _int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
