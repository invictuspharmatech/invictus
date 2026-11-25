from django.db import migrations

OLD_PAY_LINE = '<p>Pay with Bitcoin: <a href="{{pay_now_url}}">{{pay_now_url}}</a></p>'
NEW_PAY_BLOCK = "{{pay_now_html}}"


def upgrade_order_placed_body(apps, schema_editor):
    EmailTemplate = apps.get_model("cms", "EmailTemplate")
    row = EmailTemplate.objects.filter(event_key="order_placed").first()
    if not row or not row.body:
        return
    body = row.body
    if "{{pay_now_html}}" in body:
        return
    if OLD_PAY_LINE in body:
        body = body.replace(OLD_PAY_LINE, NEW_PAY_BLOCK)
    elif "{{pay_now_url}}" in body:
        # Any leftover raw-link markup → swap token usage to the button block.
        body = body.replace(
            '<a href="{{pay_now_url}}">{{pay_now_url}}</a>',
            NEW_PAY_BLOCK,
        )
        body = body.replace("{{pay_now_url}}", NEW_PAY_BLOCK)
    else:
        # Insert before shipping line when present, otherwise append.
        needle = "<p>Ship to:"
        if needle in body:
            body = body.replace(needle, f"{NEW_PAY_BLOCK}\n{needle}", 1)
        else:
            body = f"{body.rstrip()}\n{NEW_PAY_BLOCK}\n"
    row.body = body
    row.save(update_fields=["body"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0012_contact_notify_admin_off"),
    ]

    operations = [
        migrations.RunPython(upgrade_order_placed_body, noop_reverse),
    ]
