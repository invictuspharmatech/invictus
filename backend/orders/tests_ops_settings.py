from django.test import TestCase
from django.utils import timezone

from cms.dashboard_tiles import default_layout, normalize_layout
from cms.models import SiteSetting
from orders.models import Order
from orders.order_numbers import (
    SEQUENCE_MAX,
    allocate_order_number,
    format_order_number,
    preview_order_number,
)
from orders.shop_config import (
    checkout_limit_error,
    save_affiliate_defaults,
    save_checkout_limits,
    save_shipping_fees,
)


class DashboardTilesTests(TestCase):
    def test_normalize_drops_unknown_and_duplicate_tiles(self):
        layout = normalize_layout(
            {
                "tiles": [
                    {"id": "sales_today", "row": 1, "sort": 0, "color": "threshold_sales", "enabled": True},
                    {"id": "sales_today", "row": 2, "sort": 0, "color": "danger"},
                    {"id": "not_a_tile", "row": 1, "sort": 1, "color": "info"},
                ]
            }
        )
        self.assertEqual(len(layout["tiles"]), 1)
        self.assertEqual(layout["tiles"][0]["id"], "sales_today")

    def test_default_layout_has_current_dashboard_metrics(self):
        ids = {tile["id"] for tile in default_layout()["tiles"]}
        self.assertIn("orders_failed", ids)
        self.assertIn("sales_today", ids)
        self.assertIn("products_low_stock", ids)


class CheckoutSettingsTests(TestCase):
    def test_minimum_order_uses_charged_merchandise(self):
        save_checkout_limits({"minOrderAmount": 100, "includeShippingInOrderLimit": False})
        self.assertIsNone(checkout_limit_error(charged_merchandise=100, shipping=20))
        self.assertIsNotNone(checkout_limit_error(charged_merchandise=99, shipping=20))

    def test_include_shipping_in_limit(self):
        save_checkout_limits({"minOrderAmount": 100, "includeShippingInOrderLimit": True})
        self.assertIsNone(checkout_limit_error(charged_merchandise=80, shipping=20))
        self.assertIsNotNone(checkout_limit_error(charged_merchandise=80, shipping=19))

    def test_shipping_fees_round_trip(self):
        rows = save_shipping_fees(
            [{"name": "Express", "fee": "35.5", "sortOrder": 1}, {"name": "Ground", "fee": 15, "sort_order": 0}]
        )
        self.assertEqual([row["name"] for row in rows], ["Ground", "Express"])
        self.assertEqual(rows[1]["fee"], 35.5)

    def test_affiliate_percent_capped(self):
        saved = save_affiliate_defaults({"payoutType": "COMMISSION", "type": "PERCENT", "amount": 250})
        self.assertEqual(saved["amount"], 100)
        self.assertEqual(saved["payoutType"], "COMMISSION")


class SequentialOrderNumberTests(TestCase):
    def test_preview_matches_format(self):
        year = timezone.now().year
        self.assertEqual(preview_order_number(), f"{year}W10001")

    def test_allocates_year_warehouse_sequence(self):
        year = timezone.now().year
        first = allocate_order_number("WAREHOUSE_1")
        second = allocate_order_number("WAREHOUSE_1")
        w2 = allocate_order_number("WAREHOUSE_2")
        self.assertEqual(first, f"{year}W10001")
        self.assertEqual(second, f"{year}W10002")
        self.assertEqual(w2, f"{year}W20001")
        self.assertTrue(SiteSetting.objects.filter(key__startswith="order_numbering.seq.").exists())

    def test_sequence_wraps_at_1000(self):
        year = timezone.now().year
        SiteSetting.objects.create(
            key=f"order_numbering.seq.{year}|W1",
            value=str(SEQUENCE_MAX),
            label="seq",
            group="order_numbering",
        )
        next_num = allocate_order_number("WAREHOUSE_1")
        self.assertEqual(next_num, format_order_number(year, "WAREHOUSE_1", 1))

    def test_skips_existing_order_number_after_wrap(self):
        year = timezone.now().year
        Order.objects.create(
            order_number=format_order_number(year, "WAREHOUSE_1", 1),
            group_id="g1",
            warehouse="WAREHOUSE_1",
            status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.PENDING,
            merchandise_total=0,
            shipping_total=0,
            grand_total=0,
            customer_name="x",
            customer_email="x@example.com",
            shipping_line1="1",
            shipping_city="c",
            shipping_state="s",
            shipping_postal="1",
        )
        SiteSetting.objects.create(
            key=f"order_numbering.seq.{year}|W1",
            value=str(SEQUENCE_MAX),
            label="seq",
            group="order_numbering",
        )
        next_num = allocate_order_number("WAREHOUSE_1")
        self.assertEqual(next_num, format_order_number(year, "WAREHOUSE_1", 2))
