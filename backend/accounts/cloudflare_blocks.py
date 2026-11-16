"""Send a blocked public IP to the Cloudflare account rule from the server."""

from __future__ import annotations

import ipaddress
import json
import logging
import threading
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.db import transaction

from cms.ops_settings import get_json, save_json

logger = logging.getLogger(__name__)

SETTING_KEY = "security.cloudflare_ip_block"
SETTING_LABEL = "Site-wide IP block"
SETTING_GROUP = "security"


def enabled() -> bool:
    value = get_json(SETTING_KEY, {"enabled": False})
    return bool(value.get("enabled")) if isinstance(value, dict) else False


def configured() -> bool:
    return token() != "" and account_id() != ""


def status_payload() -> dict:
    return {"enabled": enabled(), "credentials_ready": configured()}


def save_enabled(value: bool) -> None:
    save_json(SETTING_KEY, {"enabled": bool(value)}, SETTING_LABEL, SETTING_GROUP)


def queue_enforce(ip: str) -> None:
    if not enabled() or not configured() or not _public(ip):
        return
    _schedule(lambda: enforce(ip))


def queue_lift(ip: str, rule_id: str | None) -> None:
    if not configured() or not _public(ip):
        return
    _schedule(lambda: lift(ip, rule_id))


def queue_enforce_current() -> None:
    if not enabled() or not configured():
        return
    from accounts.models import PasswordResetIpBlock
    from orders.models import ContactIpBlock

    ips = set(
        ContactIpBlock.objects.filter(blocked_at__isnull=False).values_list("ip_address", flat=True)
    )
    ips.update(
        PasswordResetIpBlock.objects.filter(blocked_at__isnull=False).values_list("ip_address", flat=True)
    )
    for ip in ips:
        if isinstance(ip, str):
            queue_enforce(ip)


def enforce(ip: str) -> None:
    if not enabled() or not configured() or not _public(ip):
        return
    from accounts.models import PasswordResetIpBlock
    from orders.models import ContactIpBlock

    rule_id = _existing_rule_id(ip) or _create_rule(ip)
    if not rule_id:
        return
    ContactIpBlock.objects.filter(ip_address=ip, blocked_at__isnull=False).update(cloudflare_rule_id=rule_id)
    PasswordResetIpBlock.objects.filter(ip_address=ip, blocked_at__isnull=False).update(cloudflare_rule_id=rule_id)


def lift(ip: str, rule_id: str | None) -> None:
    if not configured() or not _public(ip):
        return
    from accounts.models import PasswordResetIpBlock
    from orders.models import ContactIpBlock

    still = ContactIpBlock.objects.filter(ip_address=ip, blocked_at__isnull=False).exists() or PasswordResetIpBlock.objects.filter(
        ip_address=ip, blocked_at__isnull=False
    ).exists()
    if still:
        return
    chosen = rule_id if isinstance(rule_id, str) and rule_id else _existing_rule_id(ip)
    if chosen:
        _delete_rule(chosen)
    ContactIpBlock.objects.filter(ip_address=ip).update(cloudflare_rule_id=None)
    PasswordResetIpBlock.objects.filter(ip_address=ip).update(cloudflare_rule_id=None)


def _schedule(fn) -> None:
    def run() -> None:
        threading.Thread(target=_safe, args=(fn,), daemon=True).start()

    if transaction.get_connection().in_atomic_block:
        transaction.on_commit(run)
    else:
        run()


def _safe(fn) -> None:
    try:
        fn()
    except Exception:
        logger.warning("Cloudflare IP block call failed.")


def _existing_rule_id(ip: str) -> str | None:
    from accounts.models import PasswordResetIpBlock
    from orders.models import ContactIpBlock

    for model in (ContactIpBlock, PasswordResetIpBlock):
        value = model.objects.filter(ip_address=ip).values_list("cloudflare_rule_id", flat=True).first()
        if isinstance(value, str) and value:
            return value
    return None


def _create_rule(ip: str) -> str | None:
    target = "ip6" if ":" in ip else "ip"
    status, payload = _request(
        "POST",
        _rules_url(),
        {
            "mode": "block",
            "configuration": {"target": target, "value": ip},
            "notes": "Blocked from Invictus store",
        },
    )
    rule_id = (payload.get("result") or {}).get("id") if isinstance(payload, dict) else None
    if status and 200 <= status < 300 and isinstance(rule_id, str) and rule_id:
        return rule_id
    return _find_remote_rule_id(ip, target)


def _find_remote_rule_id(ip: str, target: str) -> str | None:
    query = urllib.parse.urlencode(
        {
            "mode": "block",
            "per_page": 5,
            "configuration.target": target,
            "configuration.value": ip,
        }
    )
    status, payload = _request("GET", f"{_rules_url()}?{query}")
    rows = payload.get("result") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        logger.warning("Cloudflare IP block was not created.", extra={"ip": ip, "status": status})
        return None
    for row in rows:
        if not isinstance(row, dict):
            continue
        config = row.get("configuration") if isinstance(row.get("configuration"), dict) else {}
        if config.get("value") == ip and isinstance(row.get("id"), str) and row.get("id"):
            return row["id"]
    logger.warning("Cloudflare IP block was not created.", extra={"ip": ip, "status": status})
    return None


def _delete_rule(rule_id: str) -> None:
    status, _payload = _request("DELETE", f"{_rules_url()}/{urllib.parse.quote(rule_id, safe='')}")
    if status not in (None,) and not (200 <= status < 300 or status == 404):
        logger.warning("Cloudflare IP block was not removed.", extra={"status": status})


def _request(method: str, url: str, payload: dict | None = None) -> tuple[int | None, dict]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Authorization", f"Bearer {token()}")
    request.add_header("Accept", "application/json")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {}
        return exc.code, parsed if isinstance(parsed, dict) else {}
    except Exception:
        logger.warning("Cloudflare IP block call failed.")
        return None, {}


def _rules_url() -> str:
    return (
        "https://api.cloudflare.com/client/v4/accounts/"
        + urllib.parse.quote(account_id(), safe="")
        + "/firewall/access_rules/rules"
    )


def token() -> str:
    return str(getattr(settings, "CLOUDFLARE_API_TOKEN", "") or "").strip()


def account_id() -> str:
    return str(getattr(settings, "CLOUDFLARE_ACCOUNT_ID", "") or "").strip()


def _public(ip: str) -> bool:
    try:
        parsed = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (
        parsed.is_private
        or parsed.is_reserved
        or parsed.is_loopback
        or parsed.is_link_local
        or parsed.is_unspecified
    )
