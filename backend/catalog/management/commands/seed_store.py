import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from catalog.models import Category, Product, ProductCategory, TestResult
from cms.models import Banner, FAQItem, NavigationLink, Page, SiteSetting
from orders.models import Order, OrderItem

STAFF = [
    ("super@invictuspharma.com", "Super User", User.Role.SUPERUSER, "InvictusSuper!2026"),
    ("admin1@invictuspharma.com", "Admin One", User.Role.ADMIN, "AdminOne!2026"),
    ("admin2@invictuspharma.com", "Admin Two", User.Role.ADMIN, "AdminTwo!2026"),
    ("admin3@invictuspharma.com", "Admin Three", User.Role.ADMIN, "AdminThree!2026"),
    ("admin4@invictuspharma.com", "Admin Four", User.Role.ADMIN, "AdminFour!2026"),
    ("w1@invictuspharma.com", "Warehouse 1", User.Role.WAREHOUSE_1, "WarehouseOne!2026"),
    ("w2@invictuspharma.com", "Warehouse 2", User.Role.WAREHOUSE_2, "WarehouseTwo!2026"),
]

WAREHOUSE_ONE = {"peptides-glps", "peptides-and-glps", "aminos", "peptides"}

CATEGORY_IMAGES = {
    "oils": "/images/oils.jpg",
    "orals": "/images/orals.png",
    "aminos": "/images/aminos.jpg",
    "peptides-glps": "/images/peptides.jpg",
    "pct-medications": "/images/pct.jpg",
    "gift-cards": "/images/gift-cards.jpg",
}

FAQ = [
    (
        "General Questions",
        "What is Invictus Pharma?",
        "Invictus Pharma is a trusted supplier of high-quality supplements and performance products, presented with the same catalog structure as a full-service storefront.",
    ),
    (
        "General Questions",
        "Are your products safe?",
        "Yes. Products undergo testing and quality control. Certificates of analysis are available on the Test Results page.",
    ),
    (
        "General Questions",
        "Is there a minimum order?",
        "Yes. There is a $100 minimum order.",
    ),
    (
        "General Questions",
        "Is international shipping available?",
        "We ship to the 50 US states. We cannot ship to APOs or military addresses.",
    ),
    (
        "Shipping & Delivery",
        "How much is shipping?",
        "Standard shipping is $20 per warehouse shipment. Mixed carts that split across warehouses ship as two orders, each with its own shipping fee.",
    ),
    (
        "Shipping & Delivery",
        "How long does it take to ship my order?",
        "Orders are generally shipped within 1–4 business days after payment confirmation. Some circumstances may extend this to 5 business days.",
    ),
    (
        "Shipping & Delivery",
        "Can I track my order?",
        "Yes. Tracking is emailed once the order ships, and is also available in My Orders.",
    ),
    (
        "Shipping & Delivery",
        "My package hasn't been delivered. What now?",
        "We have a reship policy for lost packages once lost status is confirmed. Review Processing & Shipping, then contact support.",
    ),
    (
        "Payments",
        "What payment methods do you accept?",
        "We accept Bitcoin (BTC) only. See the Bitcoin Tutorial under Tools & Resources.",
    ),
    (
        "Payments",
        "Is my payment information secure?",
        "Payments are processed through encrypted channels. Bitcoin transactions cannot be reversed, so always confirm the amount before sending.",
    ),
    (
        "Returns, quality & orders",
        "What is your return policy?",
        "All sales are final. See Terms & Refunds for the full policy, including the lost-package reship terms.",
    ),
    (
        "Returns, quality & orders",
        "I am missing items or received the wrong items.",
        "Contact support with your order number and we will make it right.",
    ),
    (
        "Returns, quality & orders",
        "Do you provide certificates of analysis?",
        "Yes. Browse Test Results or contact us for a specific batch.",
    ),
]

PAGES = [
    (
        "about",
        "About Invictus Pharma",
        "Everything we do is rooted in a genuine passion for performance, optimization, and long-term health.",
        """<p>We believe that feeling your best—physically, mentally, and hormonally—shouldn't be complicated. Whether it's hormone replacement therapy, advanced biohacking strategies, or pushing the limits in the gym, we're here to support individuals who take their health and performance seriously.</p>
<p>Invictus Pharma was created with a deep understanding of the bodybuilding and performance community. From first-time TRT users to experienced enhanced athletes, our focus is a clean, organized, and reliable platform.</p>
<blockquote>Invictus Pharma isn't just a storefront. It's a reflection of a mindset—discipline, consistency, and the pursuit of better.</blockquote>""",
    ),
    (
        "processing-shipping",
        "Processing & Shipping",
        "",
        """<h2>Processing</h2>
<ul>
<li>Allow 1–4 business days after payment confirmation for shipment.</li>
<li>Payment confirmation can take up to 72 hours depending on the network and fees paid.</li>
<li>Business days are Monday–Friday, excluding holidays.</li>
<li>Bitcoin is the only accepted payment method.</li>
<li>Tracking is emailed once the order has shipped.</li>
</ul>
<h2>Shipping</h2>
<ul>
<li>Packages ship Monday–Friday, excluding holidays.</li>
<li>You can typically expect your order within a week of payment confirmation.</li>
<li>Shipping fee: $20 per warehouse shipment.</li>
<li>Mixed carts are split: warehouse 1 items become order #1, warehouse 2 items become order #2. They may not ship together.</li>
<li>We cannot ship to APOs.</li>
</ul>""",
    ),
    (
        "terms-refunds",
        "Terms & Refunds",
        "",
        """<ul>
<li>Importation responsibility: Invictus Pharma accepts no responsibility for confirming importation requirements of the purchaser's country or state. Products ship at the purchaser's risk.</li>
<li>Legal action: Invictus Pharma will not check requirements on the purchaser's behalf and is absolved from legal action regarding importation or physical effects of products.</li>
<li>You declare that you have a prescription or import permits where required.</li>
<li>Once tracking is provided, it is the purchaser's responsibility to track, receive, and collect the parcel.</li>
<li>Invictus Pharma is not responsible for postal errors, delays, or incorrect addresses.</li>
<li>We cannot ship to APOs or military addresses.</li>
<li>Orders are reserved to ship up to 5–8 business days after payment confirmation.</li>
<li>Lost packages: a 50% off reshipment policy is offered for packages lost by the carrier once lost status is confirmed.</li>
<li>Zero-refund policy. All sales are final.</li>
</ul>
<p>Minimum order amount: $100.00 USD</p>""",
    ),
    (
        "quality-guarantee",
        "Product Quality Guarantee",
        "",
        """<p>We are committed to transparency. This guarantee reflects our dedication to product quality.</p>
<ol>
<li>When you purchase a product, you may send it for lab testing to janoshik.com. If you do, you receive a credit for the cost of the lab test on your next purchase—not for the product itself.</li>
<li>The listed manufacturer of the product being tested must be Invictus Pharma.</li>
<li>Invictus Pharma may share test results as we deem appropriate.</li>
<li>Customers are limited to two test credits every six months.</li>
<li>If there is a listed Janoshik test dated within the previous 60 days for the same product, no credit will be given.</li>
<li>For tablet or capsule testing, include photos and a description of color. The Janoshik report must also include photos and color description.</li>
<li>The originating order number must be provided. Tests can only be done on products ordered in the last 90 days.</li>
<li>If we receive a bad test, we will send a batch for our own testing. If confirmed substandard, we will produce a new batch, test it, and replace the product.</li>
<li>An underdosed product is defined as more than 8% under advertised strength.</li>
</ol>""",
    ),
]

NAV = [
    ("header", "Products", "/products", 1),
    ("header", "Test Results", "/test-results", 2),
    ("header", "About", "/about", 3),
    ("footer_products", "Oils", "/products?category=oils", 1),
    ("footer_products", "Orals", "/products?category=orals", 2),
    ("footer_products", "PCT / Medications", "/products?category=pct-medications", 3),
    ("footer_products", "Peptides & GLPs", "/products?category=peptides-glps", 4),
    ("footer_products", "Aminos", "/products?category=aminos", 5),
    ("footer_products", "Gift Cards", "/products?category=gift-cards", 6),
    ("footer_company", "Test results", "/test-results", 1),
    ("footer_company", "About", "/about", 2),
    ("footer_company", "Contact", "/contact", 3),
    ("footer_company", "Affiliate program", "/affiliate", 4),
    ("footer_resources", "Bitcoin tutorial", "/bitcoin-tutorial", 1),
    ("footer_resources", "Peptide calculator", "/peptide-calculator", 2),
    ("footer_resources", "Peptide protocol", "/peptide-protocol", 3),
    ("footer_resources", "Crashed gear protocol", "/crashed-gear-protocol", 4),
    ("footer_policies", "Processing & Shipping", "/processing-shipping", 1),
    ("footer_policies", "Terms & Refunds", "/terms-refunds", 2),
    ("footer_policies", "Quality Guarantee", "/quality-guarantee", 3),
    ("footer_policies", "FAQ", "/faq", 4),
]


def slugify(value: str) -> str:
    value = value.lower().replace("&", "")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


class Command(BaseCommand):
    help = "Seed staff, catalog, test results, and CMS content."

    def handle(self, *args, **options):
        repo = Path(__file__).resolve().parents[4]
        products_path = repo / "prisma" / "data" / "products.json"
        tests_path = repo / "prisma" / "data" / "test-results.json"
        products = json.loads(products_path.read_text(encoding="utf-8"))
        tests = json.loads(tests_path.read_text(encoding="utf-8"))

        with transaction.atomic():
            for email, name, role, password in STAFF:
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={"name": name, "role": role},
                )
                user.name = name
                user.role = role
                user.set_password(password)
                user.save()

            OrderItem.objects.all().delete()
            Order.objects.all().delete()
            ProductCategory.objects.all().delete()
            Product.objects.all().delete()
            Category.objects.all().delete()
            TestResult.objects.all().delete()

            unique = {}
            for product in products:
                for category in product.get("categories") or []:
                    unique[slugify(category["name"])] = category["name"]

            category_map = {}
            for index, (slug, name) in enumerate(unique.items(), start=1):
                row = Category.objects.create(
                    slug=slug,
                    name=name,
                    image=CATEGORY_IMAGES.get(slug, ""),
                    sort_order=index,
                )
                category_map[slug] = row

            count = 0
            for product in products:
                status = product.get("status")
                if status and status not in ("publish", "active"):
                    continue
                slugs = [slugify(item["name"]) for item in product.get("categories") or []]
                warehouse = (
                    Product.Warehouse.WAREHOUSE_1
                    if any(slug in WAREHOUSE_ONE for slug in slugs)
                    else Product.Warehouse.WAREHOUSE_2
                )
                row = Product.objects.create(
                    source_id=product["sourceId"],
                    slug=f"{slugify(product['name'])}-{product['sourceId']}",
                    name=product["name"],
                    sku=product.get("sku") or "",
                    description=product.get("description") or "",
                    short_description=product.get("shortDescription") or "",
                    regular_price=product["regularPrice"],
                    sale_price=product.get("salePrice"),
                    image=product.get("image") or "",
                    stock_status=product.get("stockStatus") or "instock",
                    stock_quantity=product.get("stockQuantity"),
                    max_quantity_per_order=product.get("maxQuantityPerOrder"),
                    is_featured=bool(product.get("isFeatured")),
                    is_new_arrival=bool(product.get("isNewArrival")),
                    warehouse=warehouse,
                    status="publish",
                )
                qty = int(product.get("stockQuantity") or 0)
                if warehouse == Product.Warehouse.WAREHOUSE_1:
                    row.stock_quantity_w1 = qty
                    row.stock_quantity_w2 = 0
                else:
                    row.stock_quantity_w1 = 0
                    row.stock_quantity_w2 = qty
                row.sync_total(save=True)
                for slug in slugs:
                    category = category_map.get(slug)
                    if category:
                        ProductCategory.objects.create(product=row, category=category)
                count += 1

            for index, item in enumerate(tests):
                TestResult.objects.create(
                    product_name=item["productName"],
                    category=item["category"],
                    image_path=item["imagePath"],
                    sort_order=index,
                )

            for slug, title, lede, body in PAGES:
                Page.objects.update_or_create(
                    slug=slug,
                    defaults={
                        "title": title,
                        "lede": lede,
                        "body": body,
                        "is_published": True,
                    },
                )

            if not FAQItem.objects.exists():
                for index, (section, question, answer) in enumerate(FAQ):
                    FAQItem.objects.create(
                        section=section,
                        question=question,
                        answer=answer,
                        sort_order=index,
                    )

            Banner.objects.update_or_create(
                title="Specimen / 001",
                defaults={
                    "subtitle": "A considered collection of performance essentials, selected with the discipline of a laboratory.",
                    "href": "/products",
                    "cta_label": "Shop the catalog",
                    "is_active": True,
                    "sort_order": 1,
                },
            )

            if not NavigationLink.objects.exists():
                for location, label, href, order in NAV:
                    NavigationLink.objects.create(
                        location=location,
                        label=label,
                        href=href,
                        sort_order=order,
                    )

            SiteSetting.objects.update_or_create(
                key="homepage_kicker",
                defaults={"value": "Specimen / 001", "label": "Homepage kicker", "group": "home"},
            )
            SiteSetting.objects.update_or_create(
                key="homepage_headline",
                defaults={
                    "value": "A higher standard.",
                    "label": "Homepage headline",
                    "group": "home",
                },
            )
            SiteSetting.objects.update_or_create(
                key="homepage_lede",
                defaults={
                    "value": "Precision performance and wellness essentials, selected with purpose.",
                    "label": "Homepage lede",
                    "group": "home",
                },
            )

        w1 = Product.objects.filter(warehouse=Product.Warehouse.WAREHOUSE_1).count()
        w2 = Product.objects.filter(warehouse=Product.Warehouse.WAREHOUSE_2).count()
        self.stdout.write(self.style.SUCCESS(f"Seeded {len(STAFF)} staff and {count} products."))
        self.stdout.write(f"Warehouse split: {w1} W1 / {w2} W2")
