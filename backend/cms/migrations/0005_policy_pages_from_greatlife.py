from django.db import migrations


PROCESSING_SHIPPING_HTML = """
<h2>Processing</h2>
<ul>
<li>Please allow 1–4 business days after your payment has been confirmed for your order to ship. We will notify you if there is an exception.</li>
<li>Payment confirmation can take up to 72 hours, depending on your application of choice and fees paid.</li>
<li>Business days are Monday–Friday, excluding holidays.</li>
<li>Bitcoin is the only accepted payment method.</li>
<li>Tracking information will be provided via email once your order has shipped.</li>
</ul>
<h2>Shipping</h2>
<ul>
<li>Packages ship Monday–Friday, excluding holidays.</li>
<li>You can typically expect your order within a week of payment confirmation.</li>
<li><strong>Shipping Fee: $20.</strong></li>
<li>No express shipping options are available.</li>
<li>If your order must be shipped as multiple parcels, it may not ship together.</li>
<li>We cannot ship to APOs.</li>
</ul>
"""

TERMS_REFUNDS_HTML = """
<h2>Terms</h2>
<ul>
<li><strong>Importation Responsibility:</strong> www.invictuspharma.net accepts no responsibility for confirming importation requirements and regulations of the purchaser's country/state of origin. All products are shipped at the purchaser's risk, and purchasers are liable for knowing their country's laws.</li>
<li><strong>Legal Action:</strong> www.invictuspharma.net accepts no responsibility for country/state laws and will not check requirements on the purchaser's behalf. www.invictuspharma.net is absolved from any legal action regarding importation or physical effects of chemicals/medicines.</li>
<li><strong>Prescriptions:</strong> You declare that you have a prescription or import permits for ordered drugs/products.</li>
<li><strong>Tracking:</strong> Once an order tracking number is provided, it's the purchaser's responsibility to track, receive, recover, and collect their parcel, and communicate with their national postal carrier.</li>
<li><strong>Postal Issues:</strong> www.invictuspharma.net is not responsible for postal service errors, delays, or incorrect addresses provided by the customer.</li>
<li><strong>Shipping Limitations:</strong> We cannot ship to APOs or military addresses.</li>
<li><strong>Shipping Time:</strong> Orders are reserved to ship up to 5–8 business days after payment confirmation.</li>
<li><strong>Lost Packages:</strong> A 50% off reshipment policy is offered for packages lost by the mail carrier, provided the "Lost status" is confirmed by www.invictuspharma.net.</li>
<li><strong>Zero-Refund Policy:</strong> All sales are final. No refunds are allowed.</li>
<li>I have read, understood, and accept to be bound by the policies and terms set forth in the Terms &amp; Refunds.</li>
</ul>
<h2>Refunds</h2>
<ul>
<li>All sales are final – No refunds are allowed.</li>
</ul>
<h2>Minimum Order Amount</h2>
<ul>
<li><strong>$100.00 USD</strong></li>
</ul>
"""

QUALITY_GUARANTEE_HTML = """
<p>Welcome to <a href="/">www.invictuspharma.net</a>! We are committed to complete transparency and integrity in everything we do. Our Product Quality Guarantee reflects our dedication to providing you with the highest quality products and ensuring your complete satisfaction.</p>
<h2>1. Testing and Credit:</h2>
<p>When you purchase any product from <a href="/">www.invictuspharma.net</a>, you have the option to send it for lab testing to <a href="https://janoshik.com" target="_blank" rel="noreferrer">janoshik.com</a>. If you choose this option, you'll receive a credit for the cost of the lab test on your next purchase, not for the product itself.</p>
<h2>2. Manufacturer:</h2>
<p>The listed manufacturer of the product being tested must be <a href="/">www.invictuspharma.net</a>.</p>
<h2>3. Test Results Sharing:</h2>
<p><a href="/">www.invictuspharma.net</a> reserves the right to share the test results in any manner we deem appropriate.</p>
<h2>4. Limitations on Testing Credits:</h2>
<p>Customers are limited to two test credits per customer every six months.</p>
<h2>5. Recent Testing:</h2>
<p>If there is a listed Janoshik test dated within the previous 60 days for the same product, no credit will be given. Please refer to the link for Janoshik testing results on our website.</p>
<h2>6. Testing Requirements:</h2>
<p>For tablet or capsule testing, you must include photos of the tablets and a description, including the color of the tablet or capsule. The Janoshik test must also have photos and description including the color of product on test results.</p>
<h2>7. Order Information:</h2>
<p>The order number from which the sample originated must be provided. Tests can only be done on products ordered in the last 90 days.</p>
<h2>8. Response to Bad Tests:</h2>
<p>If we receive a bad test result, we will send a batch for our own testing. If it is confirmed to be substandard, we will produce a new batch from a new set of raw materials, test it, and replace the bad product upon receiving acceptable test results.</p>
<h2>9. Definition of Underdosed Product:</h2>
<p>An underdosed product is defined as any product that is more than 8% under the advertised strength. For example, a Deca product advertised at 250mg that tests below 230mg.</p>
<p>Take advantage of this offer today and shop with confidence, knowing that your satisfaction and trust are our top priorities! Thank you for being part of the <a href="/">www.invictuspharma.net</a> community.</p>
<p><a href="https://janoshik.com/HowToOrder.pdf" target="_blank" rel="noreferrer">https://janoshik.com/HowToOrder.pdf</a></p>
<p><em>***Roidtest or any other "home test" do not qualify and will not be accepted.</em></p>
"""


def update_policies(apps, schema_editor):
    Page = apps.get_model("cms", "Page")
    FAQItem = apps.get_model("cms", "FAQItem")
    pages = {
        "processing-shipping": ("Processing & Shipping", PROCESSING_SHIPPING_HTML),
        "terms-refunds": ("Terms & Refunds", TERMS_REFUNDS_HTML),
        "quality-guarantee": ("Product Quality Guarantee", QUALITY_GUARANTEE_HTML),
    }
    for slug, (title, body) in pages.items():
        Page.objects.update_or_create(
            slug=slug,
            defaults={
                "title": title,
                "lede": "",
                "body": body.strip(),
                "is_published": True,
            },
        )
    FAQItem.objects.filter(question="How much is shipping?").update(
        answer="Standard shipping is $20."
    )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("cms", "0004_remove_global_backorder"),
    ]

    operations = [
        migrations.RunPython(update_policies, noop),
    ]
