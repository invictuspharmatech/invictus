import json

from django.db import migrations

LAYOUT_KEY = "dashboard.tiles_layout"
TILE_ID = "zoho_inbox_unread"


def add_zoho_unread_tile(apps, schema_editor):
    SiteSetting = apps.get_model("cms", "SiteSetting")
    row = SiteSetting.objects.filter(pk=LAYOUT_KEY).first()
    if not row or not row.value:
        return
    try:
        layout = json.loads(row.value)
    except json.JSONDecodeError:
        return
    tiles = layout.get("tiles") if isinstance(layout, dict) else None
    if not isinstance(tiles, list):
        return
    if any(isinstance(t, dict) and t.get("id") == TILE_ID for t in tiles):
        return
    max_row = 1
    max_sort = -1
    for tile in tiles:
        if not isinstance(tile, dict):
            continue
        try:
            max_row = max(max_row, int(tile.get("row") or 1))
            max_sort = max(max_sort, int(tile.get("sort") or 0))
        except (TypeError, ValueError):
            continue
    tiles.append(
        {
            "id": TILE_ID,
            "row": max_row,
            "sort": max_sort + 1,
            "color": "warning",
            "enabled": True,
            "colSpan": 1,
            "label": None,
        }
    )
    row.value = json.dumps({"tiles": tiles})
    row.save(update_fields=["value"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0015_email_verification_button"),
    ]

    operations = [
        migrations.RunPython(add_zoho_unread_tile, noop_reverse),
    ]
