from django.db import migrations


def turn_off_contact_admin_blast(apps, schema_editor):
    EmailTemplate = apps.get_model("cms", "EmailTemplate")
    EmailTemplate.objects.filter(event_key="contact_received").update(notify_admin=False)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0011_email_verification_template"),
    ]

    operations = [
        migrations.RunPython(turn_off_contact_admin_blast, noop_reverse),
    ]
