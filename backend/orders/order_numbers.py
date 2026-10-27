from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from cms.models import SiteSetting
from cms.ops_settings import get_json, save_json

CONFIG_KEY = "order_numbering"
# Per year + warehouse: 0001–1000, then wraps back to 0001.
SEQUENCE_MAX = 1000
SEQUENCE_WIDTH = 4


def get_order_numbering() -> dict:
    """Kept for ops settings API compatibility; format is fixed."""
    raw = get_json(CONFIG_KEY, {}) or {}
    if not isinstance(raw, dict):
        raw = {}
    return {
        "enabled": True,
        "prefix": "",
        "numDigits": SEQUENCE_WIDTH,
        "sequenceMax": SEQUENCE_MAX,
        "format": "YYYYW{1|2}NNNN",
    }


def save_order_numbering(payload: dict) -> dict:
    # Format is fixed; persist a marker so the settings panel can round-trip.
    data = payload or {}
    saved = {
        "enabled": True,
        "prefix": "",
        "numDigits": SEQUENCE_WIDTH,
        "sequenceMax": SEQUENCE_MAX,
        "format": "YYYYW{1|2}NNNN",
        "note": str(data.get("note") or ""),
    }
    save_json(CONFIG_KEY, saved, "Order numbers", "orders")
    return get_order_numbering()


def warehouse_order_suffix(warehouse: str) -> str:
    return "1" if warehouse == "WAREHOUSE_1" else "2"


def format_order_number(year: int, warehouse: str, seq: int) -> str:
    return f"{int(year)}W{warehouse_order_suffix(warehouse)}{str(int(seq)).zfill(SEQUENCE_WIDTH)}"


def preview_order_number(config: dict | None = None) -> str:
    return format_order_number(timezone.now().year, "WAREHOUSE_1", 1)


def allocate_order_number(warehouse: str) -> str:
    """Next number for this warehouse: 2026W10001 … 2026W11000, then wrap."""
    from orders.models import Order

    year = int(timezone.now().strftime("%Y"))
    wh = warehouse_order_suffix(warehouse)
    for _ in range(SEQUENCE_MAX):
        seq = _allocate_sequence(year, wh)
        candidate = f"{year}W{wh}{str(seq).zfill(SEQUENCE_WIDTH)}"
        if not Order.objects.filter(order_number=candidate).exists():
            return candidate
    raise ValueError(
        f"All {SEQUENCE_MAX} order numbers for warehouse {wh} in {year} are in use."
    )


def allocate_group_id() -> str:
    """
    Shared checkout group id (not warehouse-specific).
    Prefer allocate_order_number() for customer-facing numbers; callers that still
    need a pre-order link stamp can use this (W1 counter without consuming W2).
    """
    return allocate_order_number("WAREHOUSE_1")


def _allocate_sequence(year: int, warehouse_digit: str) -> int:
    scope_key = f"order_numbering.seq.{year}|W{warehouse_digit}"[:80]
    with transaction.atomic():
        row, created = SiteSetting.objects.select_for_update().get_or_create(
            key=scope_key,
            defaults={
                "value": "1",
                "label": f"Order sequence {year} W{warehouse_digit}",
                "group": "order_numbering",
            },
        )
        if created:
            return 1
        seq = _int(row.value, 0) + 1
        if seq > SEQUENCE_MAX:
            seq = 1
        row.value = str(seq)
        row.save(update_fields=["value"])
        return seq


def _int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default
