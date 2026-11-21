from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0015_order_ip_records"),
    ]

    operations = [
        migrations.AddField(
            model_name="contactipblock",
            name="block_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
