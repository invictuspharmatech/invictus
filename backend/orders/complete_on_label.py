"""Completing an order when a label/tracking is saved also emails the customer."""

from __future__ import annotations

from django.utils import timezone

from cms.mailer import send_order_event
from orders.models import Order
from orders.status import stamp_if_completed

COMPLETED_LIKE = {
    Order.Status.COMPLETED,
    Order.Status.SHIPPED,
    Order.Status.DELIVERED,
}


def mark_completed_with_tracking(order: Order, *, tracking: str = "") -> str:
    """Set COMPLETED + optional tracking. Returns the previous status."""
    previous = order.status
    if tracking:
        order.tracking_number = tracking
    order.status = Order.Status.COMPLETED
    stamp_if_completed(order)
    if not order.shipped_at:
        order.shipped_at = timezone.now()
    order.save()
    return previous


def maybe_send_completed_mail(order: Order, previous_status: str) -> None:
    """Send the shipped/completed template once when entering a completed-like status."""
    if order.status not in COMPLETED_LIKE:
        return
    if previous_status in COMPLETED_LIKE:
        return
    # Always use order_shipped so tracking merge tags are available.
    send_order_event("order_shipped", order)
