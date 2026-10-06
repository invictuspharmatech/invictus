from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0008_feature_banner_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="emailsettings",
            name="wrapper_html",
            field=models.TextField(
                blank=True,
                help_text="Optional full HTML layout. Use {{EMAIL_BODY}}, {{CURRENT_YEAR}}, and {{APP_NAME}}. Blank uses the default Invictus template.",
            ),
        ),
    ]
