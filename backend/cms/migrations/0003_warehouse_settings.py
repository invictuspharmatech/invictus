from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0002_email_notifications"),
    ]

    operations = [
        migrations.CreateModel(
            name="WarehouseSettings",
            fields=[
                (
                    "id",
                    models.PositiveSmallIntegerField(
                        default=1, editable=False, primary_key=True, serialize=False
                    ),
                ),
                ("split_enabled", models.BooleanField(default=False)),
                ("auto_split_enabled", models.BooleanField(default=False)),
                ("manual_move_enabled", models.BooleanField(default=False)),
                ("warehouse_request_enabled", models.BooleanField(default=False)),
                ("backorder_allowed", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Warehouse settings",
                "verbose_name_plural": "Warehouse settings",
            },
        ),
    ]
