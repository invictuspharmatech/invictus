from django.db import migrations, models


KNOWN_ABBREVIATIONS = {
    "oils": "OILS",
    "peptides": "PEP",
    "peptides-glps": "PEP",
    "aminos": "AMNO",
    "orals": "ORAL",
    "pct-medications": "PCTM",
}


def seed_abbreviations(apps, schema_editor):
    Category = apps.get_model("catalog", "Category")
    for slug, abbr in KNOWN_ABBREVIATIONS.items():
        Category.objects.filter(slug=slug, sku_abbreviation="").update(sku_abbreviation=abbr)


def unseed_abbreviations(apps, schema_editor):
    Category = apps.get_model("catalog", "Category")
    Category.objects.filter(slug__in=KNOWN_ABBREVIATIONS.keys()).update(sku_abbreviation="")


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0007_local_pct_product_images"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="sku_abbreviation",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Used in SKUs as IP-{ABBR}-001",
                max_length=16,
            ),
        ),
        migrations.RunPython(seed_abbreviations, unseed_abbreviations),
    ]
