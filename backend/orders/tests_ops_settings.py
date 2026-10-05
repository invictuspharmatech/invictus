from django.test import TestCase
from django.utils import timezone

from cms.dashboard_tiles import default_layout, normalize_layout
from cms.models import SiteSetting
from orders.order_numbers import allocate_group_id, save_order_numbering
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
    def test_disabled_keeps_inv_prefix(self):
        save_order_numbering({"enabled": False, "prefix": "INV", "numDigits": 5})
        group_id = allocate_group_id()
        self.assertTrue(group_id.startswith("INV-"))

    def test_enabled_uses_prefix_year_and_padding(self):
        save_order_numbering({"enabled": True, "prefix": "INV", "numDigits": 5})
        first = allocate_group_id()
        second = allocate_group_id()
        year = timezone.now().year
        self.assertEqual(first, f"INV{year}00001")
        self.assertEqual(second, f"INV{year}00002")
        self.assertTrue(SiteSetting.objects.filter(key__startswith="order_numbering.seq.").exists())
