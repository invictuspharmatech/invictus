from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cms", "0005_policy_pages_from_greatlife"),
    ]

    operations = [
        migrations.AddField(
            model_name="warehousesettings",
            name="w1_contact",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="warehousesettings",
            name="w1_name",
            field=models.CharField(blank=True, default="Warehouse 1", max_length=160),
        ),
        migrations.AddField(
            model_name="warehousesettings",
            name="w1_notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="warehousesettings",
            name="w2_contact",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="warehousesettings",
            name="w2_name",
            field=models.CharField(blank=True, default="Warehouse 2", max_length=160),
        ),
        migrations.AddField(
            model_name="warehousesettings",
            name="w2_notes",
            field=models.TextField(blank=True),
        ),
    ]
