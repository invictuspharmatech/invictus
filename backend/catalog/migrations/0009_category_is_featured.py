from django.db import migrations, models

# Match prior hardcoded homepage list so deploy keeps the same categories visible.
HOME_FEATURED_SLUGS = (
    "aminos",
    "orals",
    "oils",
    "peptides-glps",
    "peptides",
    "pct-medications",
)


def seed_featured_categories(apps, schema_editor):
    Category = apps.get_model("catalog", "Category")
    Category.objects.filter(slug__in=HOME_FEATURED_SLUGS).update(is_featured=True)


def unseed_featured_categories(apps, schema_editor):
    Category = apps.get_model("catalog", "Category")
    Category.objects.filter(slug__in=HOME_FEATURED_SLUGS).update(is_featured=False)


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0008_category_sku_abbreviation"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="is_featured",
            field=models.BooleanField(
                default=False,
                help_text="Show this category on the homepage carousel.",
            ),
        ),
        migrations.RunPython(seed_featured_categories, unseed_featured_categories),
    ]
