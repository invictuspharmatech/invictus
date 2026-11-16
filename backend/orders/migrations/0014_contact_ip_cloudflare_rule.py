from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0013_contact_ip_blocks"),
    ]

    operations = [
        migrations.AddField(
            model_name="contactipblock",
            name="cloudflare_rule_id",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
    ]
