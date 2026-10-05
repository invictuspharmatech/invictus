from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0007_bulk_email"),
    ]

    operations = [
        migrations.AddField(
            model_name="banner",
            name="bg_color_mode",
            field=models.CharField(default="brand-orange", max_length=32),
        ),
        migrations.AddField(
            model_name="banner",
            name="text_color_mode",
            field=models.CharField(default="light", max_length=16),
        ),
        migrations.AddField(
            model_name="banner",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
