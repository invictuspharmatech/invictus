"""Footer Telegram link — hidden until staff enable it with a URL."""

from __future__ import annotations

from cms.ops_settings import get_json, save_json

SETTING_KEY = "footer.telegram"
SETTING_LABEL = "Footer Telegram link"
SETTING_GROUP = "footer"
DEFAULT = {"enabled": False, "url": "https://t.me/invictuspharma"}


def get_footer_telegram() -> dict:
    raw = get_json(SETTING_KEY, DEFAULT)
    if not isinstance(raw, dict):
        raw = DEFAULT
    url = str(raw.get("url") or DEFAULT["url"]).strip()
    if not url:
        url = DEFAULT["url"]
    return {"enabled": bool(raw.get("enabled")), "url": url}


def save_footer_telegram(enabled: bool, url: str) -> dict:
    cleaned = str(url or "").strip()
    if not cleaned:
        cleaned = DEFAULT["url"]
    payload = {"enabled": bool(enabled), "url": cleaned}
    save_json(SETTING_KEY, payload, SETTING_LABEL, SETTING_GROUP)
    return payload


def public_footer_telegram() -> dict:
    """Only expose the URL when enabled."""
    data = get_footer_telegram()
    if not data["enabled"]:
        return {"enabled": False, "url": None}
    return {"enabled": True, "url": data["url"]}
