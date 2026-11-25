from django.db import migrations

TRACKING_TOKEN = "{{tracking_html}}"


def upgrade_shipped_body(apps, schema_editor):
    EmailTemplate = apps.get_model("cms", "EmailTemplate")
    row = EmailTemplate.objects.filter(event_key="order_shipped").first()
    if not row or not row.body:
        return
    body = row.body
    if TRACKING_TOKEN in body:
        return
    needle = "<p>Items: {{items}}</p>"
    if needle in body:
        body = body.replace(needle, f"{needle}\n{TRACKING_TOKEN}", 1)
    else:
        body = f"{body.rstrip()}\n{TRACKING_TOKEN}\n"
    row.body = body
    if row.description and "tracking" not in row.description.lower():
        row.description = (
            "Sent when an order is completed/shipped with tracking. "
            "Use {{tracking_html}} for the track button."
        )
        row.save(update_fields=["body", "description"])
    else:
        row.save(update_fields=["body"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0013_order_placed_pay_now_button"),
    ]

    operations = [
        migrations.RunPython(upgrade_shipped_body, noop_reverse),
    ]
