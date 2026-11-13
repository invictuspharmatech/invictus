"""Public visitor address. Private and reserved addresses are ignored."""

from __future__ import annotations

import ipaddress


def _public(value: str | None) -> str | None:
    if not value:
        return None
    candidate = value.strip()
    if not candidate:
        return None
    try:
        ip = ipaddress.ip_address(candidate)
    except ValueError:
        return None
    if ip.is_private or ip.is_reserved or ip.is_loopback or ip.is_link_local or ip.is_unspecified:
        return None
    return str(ip)


def client_ip(request) -> str | None:
    cloudflare = _public(request.headers.get("CF-Connecting-IP"))
    if cloudflare:
        return cloudflare
    real = _public(request.headers.get("X-Real-IP"))
    if real:
        return real
    forwarded = request.headers.get("X-Forwarded-For") or ""
    for part in forwarded.split(","):
        ip = _public(part)
        if ip:
            return ip
    return _public(request.META.get("REMOTE_ADDR"))
