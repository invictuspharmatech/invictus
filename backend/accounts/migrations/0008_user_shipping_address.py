from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_user_login_ip_records"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="shipping_line1",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="user",
            name="shipping_line2",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="user",
            name="shipping_city",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="user",
            name="shipping_state",
            field=models.CharField(blank=True, max_length=120),
        ),
        migrations.AddField(
            model_name="user",
            name="shipping_postal",
            field=models.CharField(blank=True, max_length=40),
        ),
        migrations.AddField(
            model_name="user",
            name="shipping_country",
            field=models.CharField(blank=True, default="US", max_length=8),
        ),
    ]
