from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("orders", "0012_coupon_include_shipping"),
    ]

    operations = [
        migrations.CreateModel(
            name="ContactIpBlock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("ip_address", models.CharField(max_length=45, unique=True)),
                ("rejected_count", models.PositiveSmallIntegerField(default=0)),
                ("blocked_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ["-blocked_at"]},
        ),
    ]
