from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_blocked_email_domains"),
    ]

    operations = [
        migrations.CreateModel(
            name="PasswordResetIpBlock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ip_address", models.CharField(max_length=45, unique=True)),
                ("attempted_email", models.CharField(blank=True, max_length=255)),
                ("blocked_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
