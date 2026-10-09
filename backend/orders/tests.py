from decimal import Decimal

from django.test import SimpleTestCase, TestCase

from orders.accounting import (
    allocate_for_warehouse,
    allocate_sale,
    default_split,
    validate_split,
    w1_merchandise_share,
)
from orders.models import Order


class RevenueSplitTests(SimpleTestCase):
    def test_w1_only_is_25_60_15(self):
        admin, party1, party2 = allocate_sale(Decimal("100"), Decimal("1"))
        self.assertEqual(admin, Decimal("25"))
        self.assertEqual(party1, Decimal("60"))
        self.assertEqual(party2, Decimal("15"))
        self.assertEqual(admin + party1 + party2, Decimal("100"))

    def test_w2_only_is_25_0_75(self):
        admin, party1, party2 = allocate_sale(Decimal("100"), Decimal("0"))
        self.assertEqual(admin, Decimal("25"))
        self.assertEqual(party1, Decimal("0"))
        self.assertEqual(party2, Decimal("75"))
        self.assertEqual(admin + party1 + party2, Decimal("100"))

    def test_mixed_example_40_percent_w1(self):
        x = w1_merchandise_share(Decimal("40"), Decimal("60"))
        self.assertEqual(x, Decimal("0.4"))
        admin, party1, party2 = allocate_sale(Decimal("100"), x)
        self.assertEqual(admin, Decimal("25"))
        self.assertEqual(party1, Decimal("24"))
        self.assertEqual(party2, Decimal("51"))
        self.assertEqual(admin + party1 + party2, Decimal("100"))

    def test_btc_proceeds_use_same_percentages(self):
        proceeds = Decimal("0.08")
        admin, party1, party2 = allocate_sale(proceeds, Decimal("0.4"))
        self.assertEqual(admin, Decimal("0.02"))
        self.assertEqual(party1, Decimal("0.0192"))
        self.assertEqual(party2, proceeds - admin - party1)
        self.assertEqual(admin + party1 + party2, proceeds)

    def test_warehouse_filters_sum_to_both(self):
        proceeds = Decimal("140")
        x = Decimal("0.4")
        both = allocate_for_warehouse(proceeds, x, "BOTH")
        w1 = allocate_for_warehouse(proceeds, x, Order.Warehouse.WAREHOUSE_1)
        w2 = allocate_for_warehouse(proceeds, x, Order.Warehouse.WAREHOUSE_2)
        self.assertEqual(both[0], w1[0] + w2[0])
        self.assertEqual(both[1], w1[1] + w2[1])
        self.assertEqual(both[2], w1[2] + w2[2])
        self.assertEqual(sum(both), proceeds)

    def test_custom_split_is_used(self):
        split = default_split()
        split["w1_admin"] = Decimal("20")
        split["w1_party1"] = Decimal("50")
        split["w1_party2"] = Decimal("30")
        admin, party1, party2 = allocate_sale(Decimal("100"), Decimal("1"), split)
        self.assertEqual(admin, Decimal("20"))
        self.assertEqual(party1, Decimal("50"))
        self.assertEqual(party2, Decimal("30"))

    def test_split_cannot_exceed_100(self):
        parsed, error = validate_split(
            {"w1Admin": 40, "w1Party1": 40, "w1Party2": 40, "w2Admin": 25, "w2Party1": 0, "w2Party2": 75}
        )
        self.assertIsNotNone(error)
        self.assertIn("100", error or "")
        self.assertEqual(parsed["w1_admin"], Decimal("40"))

    def test_split_must_total_100(self):
        _, error = validate_split(
            {"w1Admin": 20, "w1Party1": 20, "w1Party2": 20, "w2Admin": 25, "w2Party1": 0, "w2Party2": 75}
        )
        self.assertIsNotNone(error)

    def test_default_split_validates(self):
        parsed, error = validate_split(
            {
                "w1Admin": 25,
                "w1Party1": 60,
                "w1Party2": 15,
                "w2Admin": 25,
                "w2Party1": 0,
                "w2Party2": 75,
            }
        )
        self.assertIsNone(error)
        self.assertEqual(parsed["w1_party2"], Decimal("15"))


class CustomerOrderGroupTests(SimpleTestCase):
    def test_merges_warehouse_splits_into_one_customer_order(self):
        from orders.serializers import group_customer_order_payloads

        grouped = group_customer_order_payloads(
            [
                {
                    "id": "a",
                    "groupId": "INV-1",
                    "orderNumber": "INV-1-W1",
                    "splitIndex": 1,
                    "merchandiseTotal": 50,
                    "shippingTotal": 20,
                    "grandTotal": 70,
                    "discountTotal": 0,
                    "items": [{"id": "i1", "name": "Alpha"}],
                    "btcInvoice": {"checkoutLink": "https://pay.example/1"},
                },
                {
                    "id": "b",
                    "groupId": "INV-1",
                    "orderNumber": "INV-1-W2",
                    "splitIndex": 2,
                    "merchandiseTotal": 30,
                    "shippingTotal": 0,
                    "grandTotal": 30,
                    "discountTotal": 0,
                    "items": [{"id": "i2", "name": "Beta"}],
                    "btcInvoice": None,
                },
            ]
        )
        self.assertEqual(len(grouped), 1)
        self.assertEqual(grouped[0]["orderNumber"], "INV-1")
        self.assertEqual(grouped[0]["grandTotal"], 100)
        self.assertEqual(grouped[0]["shippingTotal"], 20)
        self.assertEqual(len(grouped[0]["items"]), 2)
        self.assertEqual(grouped[0]["btcInvoice"]["checkoutLink"], "https://pay.example/1")


class GreatLifeTotalsTests(SimpleTestCase):
    def test_two_warehouse_cart_charges_shipping_once(self):
        from orders.totals import allocate_weighted, customer_checkout_totals

        totals = customer_checkout_totals(140, shipping_usd=20)
        shares = allocate_weighted(float(totals["merchandise"]), [70, 70])
        shipping_shares = allocate_weighted(float(totals["shipping"]), [1, 0])
        self.assertEqual(totals["merchandise"], 140)
        self.assertEqual(totals["shipping"], 20)
        self.assertEqual(totals["grand_total"], 160)
        self.assertEqual(shares, [70.0, 70.0])
        self.assertEqual(shipping_shares, [20.0, 0.0])
        self.assertEqual(sum(shares) + sum(shipping_shares), 160)

    def test_invoice_amount_is_merchandise_plus_one_shipping(self):
        from orders.totals import customer_checkout_totals, selling_triplet

        totals = customer_checkout_totals(140, shipping_usd=20)
        triplet = selling_triplet(totals["grand_total"], totals["shipping"])
        self.assertEqual(triplet["subtotal"], 140)
        self.assertEqual(triplet["shipping"], 20)
        self.assertEqual(triplet["grand_total"], 160)

    def test_percent_coupon_reduces_merchandise_not_shipping(self):
        from orders.totals import customer_checkout_totals, selling_triplet

        totals = customer_checkout_totals(140, coupon_discount=14, shipping_usd=20)
        triplet = selling_triplet(totals["grand_total"], totals["shipping"])
        self.assertEqual(totals["merchandise"], 126)
        self.assertEqual(totals["shipping"], 20)
        self.assertEqual(totals["grand_total"], 146)
        self.assertEqual(triplet["subtotal"], 126)

    def test_free_shipping_coupon_zeros_shipping(self):
        from orders.totals import customer_checkout_totals

        totals = customer_checkout_totals(140, free_shipping=True, shipping_usd=20)
        self.assertEqual(totals["shipping"], 0)
        self.assertEqual(totals["grand_total"], 140)

    def test_fixed_affiliate_commission_is_once_per_order(self):
        from orders.totals import affiliate_commission, allocate_weighted

        merch_shares = [70.0, 70.0]
        commission = affiliate_commission(140, commission_type="FIXED", rate=10)
        shares = [commission if index == 0 else 0.0 for index in range(len(merch_shares))]
        self.assertEqual(commission, 10)
        self.assertEqual(sum(shares), 10)
        percent = affiliate_commission(140, commission_type="PERCENT", rate=5)
        percent_shares = allocate_weighted(percent, merch_shares)
        self.assertEqual(percent, 7)
        self.assertEqual(sum(percent_shares), 7)

    def test_selling_triplet_caps_shipping_at_what_was_paid(self):
        from orders.totals import selling_triplet

        triplet = selling_triplet(18, 20)
        self.assertEqual(triplet["shipping"], 18)
        self.assertEqual(triplet["subtotal"], 0)
        self.assertEqual(triplet["grand_total"], 18)


class GreatLifeDashboardStatsTests(SimpleTestCase):
    def test_week_bounds_are_monday_through_sunday(self):
        from datetime import datetime
        from zoneinfo import ZoneInfo

        from orders.analytics import dashboard_period_labels, dashboard_week_bounds

        now = datetime(2026, 10, 7, 15, 30, tzinfo=ZoneInfo("UTC"))
        today_start, week_start, week_end, month_start = dashboard_week_bounds(now)
        self.assertEqual(today_start.day, 7)
        self.assertEqual(week_start.weekday(), 0)
        self.assertEqual(week_start.day, 5)
        self.assertEqual(week_end.day, 12)
        self.assertEqual(month_start.day, 1)
        labels = dashboard_period_labels(now)
        self.assertEqual(labels["todayLabel"], "Oct 7, 2026")
        self.assertEqual(labels["weekLabel"], "Oct 5 – Oct 11, 2026 (Mon–Sun)")
        self.assertEqual(labels["monthLabel"], "October 2026")

    def test_completed_this_week_matches_great_life_window(self):
        from datetime import datetime
        from zoneinfo import ZoneInfo

        from orders.analytics import COMPLETED_STATUSES, completed_this_week_q, dashboard_week_bounds
        from orders.models import Order

        now = datetime(2026, 10, 7, 15, 30, tzinfo=ZoneInfo("UTC"))
        _today, week_start, week_end, _month = dashboard_week_bounds(now)
        query = completed_this_week_q(week_start, week_end)
        self.assertEqual(
            COMPLETED_STATUSES,
            [Order.Status.COMPLETED, Order.Status.SHIPPED, Order.Status.DELIVERED],
        )
        self.assertEqual(query.connector, query.AND)
        self.assertIn("shipped_at", str(query))
        self.assertIn("updated_at", str(query))


    def test_revenue_eligible_excludes_paid_pending_like_great_life(self):
        from orders.analytics import PAID_LIKE, REVENUE_ELIGIBLE
        from orders.models import Order

        self.assertEqual(
            list(REVENUE_ELIGIBLE),
            [
                Order.Status.PROCESSING,
                Order.Status.PARTIALLY_FILLED,
                Order.Status.COMPLETED,
                Order.Status.SHIPPED,
                Order.Status.DELIVERED,
            ],
        )
        self.assertIn(Order.Status.PAID, PAID_LIKE)
        self.assertNotIn(Order.Status.PAID, REVENUE_ELIGIBLE)
        self.assertNotIn(Order.Status.FAILED, REVENUE_ELIGIBLE)

    def test_staff_status_tabs_match_great_life(self):
        from orders.models import Order
        from orders.status import canonical_status, statuses_for_tab

        self.assertEqual(canonical_status("paid"), Order.Status.PROCESSING)
        self.assertEqual(canonical_status("shipped"), Order.Status.COMPLETED)
        self.assertEqual(canonical_status("delivered"), Order.Status.COMPLETED)
        self.assertEqual(canonical_status("completed"), Order.Status.COMPLETED)
        self.assertEqual(canonical_status("refunded"), Order.Status.REFUNDED)
        self.assertEqual(canonical_status("partially_filled"), Order.Status.PARTIALLY_FILLED)
        self.assertIsNone(canonical_status("gift_card"))
        self.assertEqual(
            statuses_for_tab("processing"),
            [Order.Status.PROCESSING, Order.Status.PAID],
        )
        self.assertEqual(
            statuses_for_tab("completed"),
            [Order.Status.COMPLETED, Order.Status.SHIPPED, Order.Status.DELIVERED],
        )
        self.assertEqual(statuses_for_tab("paid"), statuses_for_tab("processing"))
        self.assertEqual(statuses_for_tab("shipped"), statuses_for_tab("completed"))
        self.assertEqual(statuses_for_tab("partially_filled"), [Order.Status.PARTIALLY_FILLED])
        self.assertEqual(statuses_for_tab("refunded"), [Order.Status.REFUNDED])
        self.assertIsNone(statuses_for_tab("all"))


class AdminCreateAndSummaryTests(TestCase):
    def setUp(self):
        from accounts.models import User
        from catalog.models import Product

        self.product = Product.objects.create(
            name="Alpha",
            slug="alpha-create",
            sku="ALPHA-CREATE",
            regular_price=50,
            stock_quantity_w1=0,
            stock_quantity_w2=10,
            warehouse=Product.Warehouse.WAREHOUSE_2,
            allow_backorder=True,
        )
        self.product.sync_total(save=True)
        self.customer = User.objects.create_user(
            email="buyer@example.com", password="pass1234", name="Buyer"
        )

    def test_preview_waives_shipping_and_uses_unit_price(self):
        from orders.admin_create import preview

        result = preview(
            {
                "items": [{"productId": str(self.product.id), "quantity": 2, "unitPrice": 40}],
                "shipping": {
                    "name": "Buyer",
                    "email": "buyer@example.com",
                    "line1": "1 Main",
                    "city": "Austin",
                    "state": "TX",
                    "postal": "78701",
                },
                "waiveShipping": True,
            }
        )
        self.assertEqual(result["merchandiseTotal"], 80)
        self.assertEqual(result["shippingTotal"], 0)
        self.assertEqual(result["grandTotal"], 80)

    def test_create_order_decrements_stock(self):
        from orders.admin_create import create
        from orders.models import Order

        payload = create(
            {
                "userId": str(self.customer.id),
                "items": [{"productId": str(self.product.id), "quantity": 1}],
                "shipping": {
                    "name": "Buyer",
                    "email": "buyer@example.com",
                    "line1": "1 Main",
                    "city": "Austin",
                    "state": "TX",
                    "postal": "78701",
                },
                "waiveShipping": True,
                "paymentMethod": "manual",
                "status": "PROCESSING",
                "sendConfirmationEmail": False,
            },
            self.customer,
        )
        self.assertTrue(payload["ok"])
        self.assertEqual(len(payload["orders"]), 1)
        order = Order.objects.get(pk=payload["orders"][0]["id"])
        self.assertEqual(order.status, Order.Status.PROCESSING)
        self.product.refresh_from_db()
        self.assertEqual(self.product.stock_quantity_w2, 9)

    def test_summary_pdf_bytes_are_pdf(self):
        from orders.summary import summary_pdf_bytes

        pdf = summary_pdf_bytes(
            {
                "totalOrders": 1,
                "filters": {"dateFrom": "", "dateTo": ""},
                "orders": [
                    {
                        "orderNumber": "INV-1-W2",
                        "customerName": "Buyer",
                        "status": "PROCESSING",
                        "createdAt": "2026-10-05",
                        "items": [{"productName": "Alpha", "quantity": 1}],
                    }
                ],
            }
        )
        self.assertTrue(pdf.startswith(b"%PDF"))
        self.assertIn(b"INV-1-W2", pdf)


class BitcoinPostageUrlTests(SimpleTestCase):
    def test_normalize_strips_create_purchase_path(self):
        from orders.bitcoinpostage import DEFAULT_API_BASE, normalize_api_base

        self.assertEqual(normalize_api_base(""), DEFAULT_API_BASE)
        self.assertEqual(normalize_api_base("https://bitcoinpostage.info"), DEFAULT_API_BASE)
        self.assertEqual(normalize_api_base("https://bitcoinpostage.info/api"), DEFAULT_API_BASE)
        self.assertEqual(
            normalize_api_base("https://bitcoinpostage.info/api/create-purchase"),
            DEFAULT_API_BASE,
        )
        self.assertEqual(
            normalize_api_base("https://bitcoinpostage.info/api/create-purchase/"),
            DEFAULT_API_BASE,
        )
        self.assertEqual(
            normalize_api_base("https://btcpostage.com/api/create-purchase"),
            "https://btcpostage.com/api",
        )


class BitcoinPostagePayloadTests(SimpleTestCase):
    def test_uspscustom_maps_to_custom_package_type(self):
        from orders.bitcoinpostage import _api_package_type

        self.assertEqual(_api_package_type("USPScustom"), "custom")
        self.assertEqual(_api_package_type("Parcel"), "Parcel")
        self.assertEqual(_api_package_type("FlatRateEnvelope"), "FlatRateEnvelope")

    def test_weight_splits_remainder_ounces(self):
        from orders.bitcoinpostage import _split_weight

        lbs, oz = _split_weight({"weight_lbs": "1", "weight_oz": "0"})
        self.assertEqual(lbs, 1)
        self.assertEqual(oz, "0")
        lbs, oz = _split_weight({"input_weight_lbs": "0", "input_weight_oz": "20"})
        self.assertEqual(lbs, 1)
        self.assertEqual(oz, "4")

    def test_purchase_result_normalizes_filename_root(self):
        from orders.bitcoinpostage import _first_item, _normalize_purchase_result

        nested = _normalize_purchase_result(
            {"data": {"items": [{"filename": "https://example.com/label.pdf"}]}}
        )
        self.assertEqual(_first_item(nested)["filename"], "https://example.com/label.pdf")
        rooted = _normalize_purchase_result({"filename": "https://example.com/a.pdf"})
        self.assertEqual(_first_item(rooted)["filename"], "https://example.com/a.pdf")

    def test_json_object_strips_bom_and_noise(self):
        from orders.bitcoinpostage import _parse_json_object

        data = _parse_json_object('\ufeff{"items":[{"filename":"x"}]}')
        self.assertEqual(data["items"][0]["filename"], "x")
        wrapped = _parse_json_object('notice {"items":[{"filename":"y"}]} trailing')
        self.assertEqual(wrapped["items"][0]["filename"], "y")


class PostageDeleteLabelTests(TestCase):
    def test_delete_keeps_latest_remaining_tracking(self):
        from datetime import timedelta

        from accounts.models import User
        from django.utils import timezone
        from orders.models import ShippingLabel
        from rest_framework.test import APIClient

        admin = User.objects.create_user(
            email="admin-labels@example.com",
            password="pass1234",
            name="Admin",
            role=User.Role.ADMIN,
        )
        order = Order.objects.create(
            order_number="INV-DEL-1",
            group_id="INV-DEL-1",
            warehouse=Order.Warehouse.WAREHOUSE_1,
            merchandise_total=10,
            shipping_total=5,
            grand_total=15,
            customer_name="Buyer",
            customer_email="buyer-labels@example.com",
            shipping_line1="1 Main",
            shipping_city="Austin",
            shipping_state="TX",
            shipping_postal="78701",
            tracking_number="TRACK-NEW",
        )
        older = ShippingLabel.objects.create(
            order=order,
            tracking_number="TRACK-OLD",
            label_url="https://example.com/old.pdf",
        )
        newer = ShippingLabel.objects.create(
            order=order,
            tracking_number="TRACK-NEW",
            label_url="https://example.com/new.pdf",
        )
        older.created_at = timezone.now() - timedelta(minutes=1)
        older.save(update_fields=["created_at"])
        client = APIClient()
        client.force_authenticate(user=admin)
        response = client.delete(f"/api/admin/orders/{order.id}/labels/{newer.id}/")
        self.assertEqual(response.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.tracking_number, "TRACK-OLD")
        self.assertFalse(ShippingLabel.objects.filter(pk=newer.id).exists())
        self.assertTrue(ShippingLabel.objects.filter(pk=older.id).exists())
        self.assertEqual(len(response.data["order"]["shippingLabels"]), 1)

