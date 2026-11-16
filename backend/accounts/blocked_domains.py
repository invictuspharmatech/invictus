"""Domains whose new accounts stay inactive and never receive a verification email."""

from __future__ import annotations

import re

from accounts.models import BlockedEmailDomain

_DOMAIN = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$")


def normalize(raw: str) -> str | None:
    value = (raw or "").strip().lower()
    value = re.sub(r"^https?://", "", value)
    value = value.split("/")[0].split(":")[0].strip(". \t")
    if "@" in value:
        value = value.rsplit("@", 1)[1]
    value = value.strip(".")
    if not _DOMAIN.fullmatch(value):
        return None
    return value


def blocks(email: str) -> bool:
    host = (email or "").strip().lower()
    if "@" in host:
        host = host.rsplit("@", 1)[1]
    host = host.strip(". \t")
    if not host or "." not in host:
        return False
    for domain in BlockedEmailDomain.objects.values_list("domain", flat=True):
        domain = str(domain).lower()
        if host == domain or host.endswith("." + domain):
            return True
    return False
