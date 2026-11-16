from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0006_password_reset_cloudflare_rule"),
    ]

    operations = [
        migrations.CreateModel(
            name="UserLoginIpRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("email", models.CharField(max_length=255)),
                ("ip_address", models.CharField(max_length=45)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="login_ip_records",
                        to="accounts.user",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["user", "-created_at"], name="login_ip_user_created_idx"),
                ],
            },
        ),
    ]
