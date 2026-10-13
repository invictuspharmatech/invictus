from django.db import migrations

LOCAL_PRODUCT_IMAGES = {
    "anastrozole-adex-1mg-10-pack.jpg",
    "cabergoline-250mcg-4-pack.png",
    "cabergoline-500mcg-4-pack.jpg",
    "clenbuterol-clen-40mcg-10-pack.jpg",
    "clomiphene-clomid-50mg-10-pack.jpg",
    "enhanced-cock-bombs-10ct.jpg",
    "exemestane-aromasin-25mg-10-pack.jpg",
    "ezetimibe-10mg-10-pack.jpg",
    "humalog-rapid-kwikpen-100iu-3ml.jpg",
    "hydrochlorothiazide-hctz-25mg-15-pack.jpg",
    "isotretinoin-accutane-20mg-10-pack.jpg",
    "lantus-long-acting-solostar-1-pen-100iu-3ml-1.jpg",
    "metformin-500mg-10-pack.jpg",
    "modafinil-100mg-10-pack.jpg",
    "nebivolol-5mg-10-pack.jpg",
    "progesterone-100mg-10-pack.jpg",
    "sildenafil-viagra-100mg-10-pack.jpg",
    "tadalafil-cialis-10mg-10-pack.png",
    "tadalafil-cialis-20mg-10-pack.jpg",
    "tamoxifen-citrate-nolva-20mg-10-pack.jpg",
    "telmisartan-80mg-15-pack.jpg",
}

LOCAL_PRODUCT_IMAGE_ALIASES = {
    "cock-bombs.png": "enhanced-cock-bombs-10ct.jpg",
}


def forwards(apps, schema_editor):
    Product = apps.get_model("catalog", "Product")
    for product in Product.objects.exclude(image=""):
        filename = product.image.replace("\\", "/").rstrip("/").split("/")[-1]
        local_name = LOCAL_PRODUCT_IMAGE_ALIASES.get(filename, filename)
        if local_name not in LOCAL_PRODUCT_IMAGES:
            continue
        new_path = f"/images/products/{local_name}"
        if product.image != new_path:
            product.image = new_path
            product.save(update_fields=["image"])


def backwards(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0006_backorder_default_off"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
