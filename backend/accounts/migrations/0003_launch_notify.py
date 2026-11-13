from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_verification_and_sessions"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="launch_notify",
            field=models.BooleanField(
                default=False,
                help_text="Opted in for coming-soon / launch notification email.",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="launch_notify_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
