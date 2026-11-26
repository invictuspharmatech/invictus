from django.db import migrations

OLD_LINK = '<p><a href="{{verification_url}}">Verify email</a></p>'
OLD_INTRO = (
    "<p>Open this link to activate <strong>{{user_email}}</strong>. "
    "It expires in {{expires_minutes}} minutes.</p>"
)
NEW_INTRO = (
    "<p>Activate <strong>{{user_email}}</strong> within "
    "{{expires_minutes}} minutes.</p>"
)
NEW_BLOCK = "{{verification_html}}"
NEW_DESCRIPTION = (
    "Sent when a new account is created. Use {{verification_html}} "
    "for the Verify E-mail button. Expires in 15 minutes."
)


def upgrade_verification_body(apps, schema_editor):
    EmailTemplate = apps.get_model("cms", "EmailTemplate")
    row = EmailTemplate.objects.filter(event_key="email_verification").first()
    if not row or not row.body:
        return
    body = row.body
    if OLD_INTRO in body:
        body = body.replace(OLD_INTRO, NEW_INTRO)
    if NEW_BLOCK not in body:
        if OLD_LINK in body:
            body = body.replace(OLD_LINK, NEW_BLOCK)
        elif "{{verification_url}}" in body:
            body = body.replace(
                '<a href="{{verification_url}}">Verify email</a>',
                NEW_BLOCK,
            )
            body = body.replace("{{verification_url}}", NEW_BLOCK)
        else:
            body = f"{body.rstrip()}\n{NEW_BLOCK}\n"
    row.body = body
    row.description = NEW_DESCRIPTION
    row.save(update_fields=["body", "description"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0014_order_shipped_tracking_html"),
    ]

    operations = [
        migrations.RunPython(upgrade_verification_body, noop_reverse),
    ]
