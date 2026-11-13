"""Block a public IP from the contact form after two rejected submits."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from accounts.client_ip import client_ip
from orders.models import ContactIpBlock

STRIKES_BEFORE_BLOCK = 2
BLOCK_MESSAGE = "This network is blocked from the contact form."


def is_blocked(request) -> bool:
    ip = client_ip(request)
    if not ip:
        return False
    return ContactIpBlock.objects.filter(ip_address=ip, blocked_at__isnull=False).exists()


def note_rejection(request) -> None:
    ip = client_ip(request)
    if not ip:
        return
    with transaction.atomic():
        row = ContactIpBlock.objects.select_for_update().filter(ip_address=ip).first()
        if row is None:
            ContactIpBlock.objects.create(ip_address=ip, rejected_count=1, blocked_at=None)
            return
        if row.blocked_at is not None:
            return
        row.rejected_count = int(row.rejected_count or 0) + 1
        if row.rejected_count >= STRIKES_BEFORE_BLOCK:
            row.blocked_at = timezone.now()
        row.save(update_fields=["rejected_count", "blocked_at", "updated_at"])
