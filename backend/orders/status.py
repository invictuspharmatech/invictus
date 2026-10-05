from __future__ import annotations

from django.utils import timezone

from orders.models import Order

PROCESSING_LIKE = (
    Order.Status.PROCESSING,
    Order.Status.PAID,
)
COMPLETED_LIKE = (
    Order.Status.COMPLETED,
    Order.Status.SHIPPED,
    Order.Status.DELIVERED,
)
OPEN_STATUSES = (
    Order.Status.PENDING,
    Order.Status.ON_HOLD,
    Order.Status.PAID,
    Order.Status.PROCESSING,
    Order.Status.PARTIALLY_FILLED,
)
PAID_LIKE = PROCESSING_LIKE + COMPLETED_LIKE + (Order.Status.PARTIALLY_FILLED,)
REVENUE_ELIGIBLE = (
    Order.Status.PROCESSING,
    Order.Status.PARTIALLY_FILLED,
    Order.Status.COMPLETED,
    Order.Status.SHIPPED,
    Order.Status.DELIVERED,
)
LOCKED_STATUSES = frozenset(
    (*COMPLETED_LIKE, Order.Status.REFUNDED, Order.Status.PARTIALLY_FILLED)
)
STAFF_TABS = (
    "pending",
    "on_hold",
    "processing",
    "partially_filled",
    "completed",
    "cancelled",
    "refunded",
    "failed",
)
STAFF_STATUSES = {
    Order.Status.PENDING,
    Order.Status.ON_HOLD,
    Order.Status.PROCESSING,
    Order.Status.PARTIALLY_FILLED,
    Order.Status.COMPLETED,
    Order.Status.CANCELLED,
    Order.Status.REFUNDED,
    Order.Status.FAILED,
}
_WRITE_ALIASES = {
    "PAID": Order.Status.PROCESSING,
    "SHIPPED": Order.Status.COMPLETED,
    "DELIVERED": Order.Status.COMPLETED,
    "COMPLETE": Order.Status.COMPLETED,
    "PARTIAL": Order.Status.PARTIALLY_FILLED,
    "PARTIALLYFILLED": Order.Status.PARTIALLY_FILLED,
    "REFUND": Order.Status.REFUNDED,
}
_TAB_ALIASES = {
    "paid": "processing",
    "shipped": "completed",
    "delivered": "completed",
    "partial": "partially_filled",
    "refund": "refunded",
}


def canonical_status(raw: object) -> str | None:
    key = str(raw or "").strip().upper().replace("-", "_")
    key = _WRITE_ALIASES.get(key, key)
    if key in STAFF_STATUSES:
        return key
    return None


def statuses_for_tab(raw: object) -> list[str] | None:
    key = str(raw or "").strip().lower().replace("-", "_")
    if key in ("", "all"):
        return None
    key = _TAB_ALIASES.get(key, key)
    if key == "processing":
        return list(PROCESSING_LIKE)
    if key == "completed":
        return list(COMPLETED_LIKE)
    return [key.upper()]


def tab_counts(queryset) -> dict[str, int]:
    counts = {"all": queryset.count()}
    for key in STAFF_TABS:
        statuses = statuses_for_tab(key) or []
        counts[key] = queryset.filter(status__in=statuses).count()
    return counts


def stamp_if_completed(order: Order) -> None:
    if order.status == Order.Status.COMPLETED and not order.shipped_at:
        order.shipped_at = timezone.now()
