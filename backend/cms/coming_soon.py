"""Coming-soon landing mode: CMS settings + public payload."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from django.utils import timezone

from cms.ops_settings import get_json, save_json

KEY = "coming_soon"
EST = ZoneInfo("America/New_York")

DEFAULTS = {
    "enabled": False,
    # Wall-clock date/time in Eastern (EST/EDT). Stored without offset; interpreted as EST.
    "launchAtLocal": "2026-11-16T00:00",
    "bannerText": "A stronger standard arrives November 16",
    "eyebrow": "Precision, not noise.",
    "dek": (
        "Invictus is built around a simple idea: <strong>the standard should be higher.</strong> "
        "A considered collection of performance and wellness essentials, selected with discipline, "
        "documented with purpose, and presented without the noise."
    ),
    "panelLabel": "Launch protocol",
    "panelHeading": "The standard<br>is almost here.",
    "panelSub": "Invictus Pharma opens soon.<br>Create an account to get the launch notice.",
}


def _bool(value, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def _str(value, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text if text else default


def parse_launch_local(raw: str) -> datetime | None:
    text = (raw or "").strip()
    if not text:
        return None
    # Accept "YYYY-MM-DDTHH:MM" or with seconds.
    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            naive = datetime.strptime(text[:19], fmt)
            return naive.replace(tzinfo=EST)
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=EST)
    return parsed.astimezone(EST)


def format_launch_bits(when: datetime | None) -> dict[str, str]:
    if not when:
        return {
            "monthLabel": "NOVEMBER",
            "dayLabel": "16",
            "dateMeta": "2026—11—16",
            "ghostNumber": "16",
            "launchDisplay": "November 16, 2026",
        }
    local = when.astimezone(EST)
    return {
        "monthLabel": local.strftime("%B").upper(),
        "dayLabel": str(local.day),
        "dateMeta": local.strftime("%Y—%m—%d"),
        "ghostNumber": str(local.day),
        "launchDisplay": f"{local.strftime('%B')} {local.day}, {local.year}",
    }


def get_coming_soon() -> dict:
    raw = get_json(KEY, None)
    if not isinstance(raw, dict):
        raw = {}
    enabled = _bool(raw.get("enabled"), DEFAULTS["enabled"])
    launch_local = _str(raw.get("launchAtLocal", raw.get("launch_at_local")), DEFAULTS["launchAtLocal"])
    when = parse_launch_local(launch_local)
    bits = format_launch_bits(when)
    banner = _str(raw.get("bannerText", raw.get("banner_text")), "")
    if not banner and when:
        banner = f"A stronger standard arrives {bits['launchDisplay'].rsplit(',', 1)[0]}"
    if not banner:
        banner = DEFAULTS["bannerText"]
    panel_label = _str(raw.get("panelLabel", raw.get("panel_label")), DEFAULTS["panelLabel"])
    panel_label_display = panel_label
    if when and panel_label:
        panel_label_display = f"{panel_label} / {when.astimezone(EST).strftime('%m.%d')}"
    return {
        "enabled": enabled,
        "launchAtLocal": launch_local,
        "launchAtIso": when.isoformat() if when else None,
        "launchAtMs": int(when.timestamp() * 1000) if when else None,
        "timezone": "America/New_York",
        "bannerText": banner,
        "eyebrow": _str(raw.get("eyebrow"), DEFAULTS["eyebrow"]),
        "dek": _str(raw.get("dek"), DEFAULTS["dek"]),
        "panelLabel": panel_label,
        "panelLabelDisplay": panel_label_display,
        "panelHeading": _str(raw.get("panelHeading", raw.get("panel_heading")), DEFAULTS["panelHeading"]),
        "panelSub": _str(raw.get("panelSub", raw.get("panel_sub")), DEFAULTS["panelSub"]),
        **bits,
    }


def save_coming_soon(payload: dict) -> dict:
    data = payload or {}
    existing = get_coming_soon()
    launch_local = _str(
        data.get("launchAtLocal", data.get("launch_at_local")),
        existing["launchAtLocal"],
    )
    if parse_launch_local(launch_local) is None and launch_local:
        raise ValueError("Launch date/time must be YYYY-MM-DDTHH:MM in Eastern time.")
    saved = {
        "enabled": _bool(data.get("enabled"), existing["enabled"]),
        "launchAtLocal": launch_local or DEFAULTS["launchAtLocal"],
        "bannerText": _str(data.get("bannerText", data.get("banner_text")), existing["bannerText"]),
        "eyebrow": _str(data.get("eyebrow"), existing["eyebrow"]),
        "dek": _str(data.get("dek"), existing["dek"]),
        "panelLabel": _str(data.get("panelLabel", data.get("panel_label")), DEFAULTS["panelLabel"]),
        "panelHeading": _str(
            data.get("panelHeading", data.get("panel_heading")), existing["panelHeading"]
        ),
        "panelSub": _str(data.get("panelSub", data.get("panel_sub")), existing["panelSub"]),
    }
    save_json(KEY, saved, "Coming soon landing", "home")
    return get_coming_soon()


def coming_soon_enabled() -> bool:
    return bool(get_coming_soon().get("enabled"))


def public_coming_soon() -> dict:
    cfg = get_coming_soon()
    return {
        "enabled": cfg["enabled"],
        "launchAtIso": cfg["launchAtIso"],
        "launchAtMs": cfg["launchAtMs"],
        "timezone": cfg["timezone"],
        "bannerText": cfg["bannerText"],
        "eyebrow": cfg["eyebrow"],
        "monthLabel": cfg["monthLabel"],
        "dayLabel": cfg["dayLabel"],
        "dateMeta": cfg["dateMeta"],
        "ghostNumber": cfg["ghostNumber"],
        "launchDisplay": cfg["launchDisplay"],
        "dek": cfg["dek"],
        "panelLabel": cfg["panelLabelDisplay"],
        "panelHeading": cfg["panelHeading"],
        "panelSub": cfg["panelSub"],
        "nowMs": int(timezone.now().timestamp() * 1000),
    }
