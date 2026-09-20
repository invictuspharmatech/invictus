from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0003_warehouse_settings"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="warehousesettings",
            name="backorder_allowed",
        ),
    ]
