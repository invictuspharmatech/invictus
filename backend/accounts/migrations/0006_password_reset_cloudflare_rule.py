from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0005_password_reset_ip_blocks"),
    ]

    operations = [
        migrations.AddField(
            model_name="passwordresetipblock",
            name="cloudflare_rule_id",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
    ]
