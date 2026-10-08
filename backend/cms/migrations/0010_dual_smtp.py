from django.db import migrations, models


def copy_smtp_into_bulk(apps, schema_editor):
    EmailSettings = apps.get_model("cms", "EmailSettings")
    for row in EmailSettings.objects.all():
        if row.bulk_smtp_host or not row.smtp_host:
            continue
        row.bulk_smtp_host = row.smtp_host
        row.bulk_smtp_port = row.smtp_port or 2525
        row.bulk_smtp_username = row.smtp_username
        row.bulk_smtp_password = row.smtp_password
        row.bulk_use_tls = row.use_tls
        row.bulk_use_ssl = row.use_ssl
        row.bulk_from_email = row.from_email
        row.bulk_from_name = row.from_name
        row.save()


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0009_email_wrapper"),
    ]

    operations = [
        migrations.AddField(
            model_name="emailsettings",
            name="bulk_smtp_host",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="emailsettings",
            name="bulk_smtp_port",
            field=models.IntegerField(default=2525),
        ),
        migrations.AddField(
            model_name="emailsettings",
            name="bulk_smtp_username",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="emailsettings",
            name="bulk_smtp_password",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="emailsettings",
            name="bulk_use_tls",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="emailsettings",
            name="bulk_use_ssl",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="emailsettings",
            name="bulk_from_email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name="emailsettings",
            name="bulk_from_name",
            field=models.CharField(blank=True, max_length=160),
        ),
        migrations.AddField(
            model_name="emailsettings",
            name="fallback_transactional_to_bulk",
            field=models.BooleanField(
                default=False,
                help_text="If transactional SMTP is missing or fails, send order and account mail through the bulk SMTP server.",
            ),
        ),
        migrations.RunPython(copy_smtp_into_bulk, migrations.RunPython.noop),
    ]
