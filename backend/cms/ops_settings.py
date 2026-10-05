import json

from cms.models import SiteSetting


def get_json(key: str, default):
    row = SiteSetting.objects.filter(pk=key).first()
    if not row or not row.value:
        return default
    try:
        return json.loads(row.value)
    except json.JSONDecodeError:
        return default


def save_json(key: str, value, label: str, group: str) -> None:
    SiteSetting.objects.update_or_create(
        key=key,
        defaults={
            "value": json.dumps(value),
            "label": label,
            "group": group,
        },
    )


def has_key(key: str) -> bool:
    return SiteSetting.objects.filter(pk=key).exists()
