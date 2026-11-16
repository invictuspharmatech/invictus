from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0014_contact_ip_cloudflare_rule"),
    ]

    operations = [
        migrations.CreateModel(
            name="OrderIpRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order_number", models.CharField(max_length=64, unique=True)),
                ("ip_address", models.CharField(max_length=45)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
