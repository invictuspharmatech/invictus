from django.db import migrations, models
from django.utils import timezone


def backfill_verified(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(email_verified_at__isnull=True).update(email_verified_at=timezone.now())


def noop(apps, schema_editor):
    return None


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="email_verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="email_verification_sends",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="user",
            name="session_version",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name="EmailVerificationToken",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.EmailField(max_length=254, unique=True)),
                ("token_hash", models.CharField(max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="SessionEpoch",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, primary_key=True, serialize=False)),
                ("version", models.PositiveIntegerField(default=0)),
            ],
        ),
        migrations.RunPython(backfill_verified, noop),
    ]
