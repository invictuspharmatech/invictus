from django.db import migrations


def add_verification_and_reset_copy(apps, schema_editor):
    EmailTemplate = apps.get_model("cms", "EmailTemplate")
    EmailTemplate.objects.get_or_create(
        event_key="email_verification",
        defaults={
            "name": "Email verification",
            "description": "Sent when a new account is created. The link expires in 15 minutes.",
            "subject": "Verify your {{site_name}} account",
            "body": (
                "<p>Hi {{user_name}},</p>"
                "<p>Open this link to activate <strong>{{user_email}}</strong>. "
                "It expires in {{expires_minutes}} minutes.</p>"
                "<p><a href=\"{{verification_url}}\">Verify email</a></p>"
                "<p>If you did not create this account, you can ignore this email.</p>"
                "<p>— {{site_name}}</p>"
            ),
            "enabled": True,
            "notify_admin": False,
            "notify_user": True,
            "notify_warehouse_manager": False,
            "sort_order": 76,
        },
    )
    reset = EmailTemplate.objects.filter(event_key="password_reset").first()
    if reset and reset.body and "hour" in reset.body:
        reset.body = reset.body.replace(
            "This link expires in {{expires_hours}} hour(s).",
            "This link expires in 15 minutes.",
        )
        reset.save(update_fields=["body"])


def noop(apps, schema_editor):
    return None


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0010_dual_smtp"),
    ]

    operations = [
        migrations.RunPython(add_verification_and_reset_copy, noop),
    ]
