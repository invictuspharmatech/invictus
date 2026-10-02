from decimal import Decimal

from django.test import SimpleTestCase

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
