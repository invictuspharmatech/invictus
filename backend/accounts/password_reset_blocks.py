"""Block password resets for the store's own email domain on the first request."""

from __future__ import annotations

from django.utils import timezone

from accounts.client_ip import client_ip
from accounts.cloudflare_blocks import queue_enforce
from accounts.models import PasswordResetIpBlock

OWNER_DOMAIN = "invictuspharma.net"
BLOCK_MESSAGE = "This network is blocked from password reset."


def protects(email: str) -> bool:
    host = (email or "").strip().lower()
    if "@" in host:
        host = host.rsplit("@", 1)[1]
    host = host.strip(".")
    return host == OWNER_DOMAIN or host.endswith("." + OWNER_DOMAIN)


def is_blocked(request) -> bool:
    ip = client_ip(request)
    if not ip:
        return False
    return PasswordResetIpBlock.objects.filter(ip_address=ip, blocked_at__isnull=False).exists()


def block(request, email: str) -> None:
    ip = client_ip(request)
    if not ip:
        return
    PasswordResetIpBlock.objects.update_or_create(
        ip_address=ip,
        defaults={"attempted_email": (email or "").strip().lower(), "blocked_at": timezone.now()},
    )
    queue_enforce(ip)
