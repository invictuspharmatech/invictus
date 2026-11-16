from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_launch_notify"),
    ]

    operations = [
        migrations.CreateModel(
            name="BlockedEmailDomain",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("domain", models.CharField(max_length=255, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["domain"],
            },
        ),
    ]
