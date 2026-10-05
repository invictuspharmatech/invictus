from django.test import SimpleTestCase

from cms.peptide_calculator import compute_syringe_ml, format_syringe_ml


class PeptideCalculatorMathTests(SimpleTestCase):
    def test_default_mg_vial_mcg_dose_matches_greatlife(self):
        ml, error = compute_syringe_ml("mg", 10, 2, "mcg", 250)
        self.assertIsNone(error)
        self.assertAlmostEqual(ml, 0.05)
        self.assertEqual(format_syringe_ml(ml or 0), "0.050")

    def test_mg_vial_mg_dose(self):
        ml, error = compute_syringe_ml("mg", 10, 2, "mg", 1)
        self.assertIsNone(error)
        self.assertAlmostEqual(ml, 0.2)

    def test_iu_vial_iu_dose(self):
        ml, error = compute_syringe_ml("iu", 1500, 2, "iu", 500)
        self.assertIsNone(error)
        self.assertAlmostEqual(ml, 2 / 3, places=6)
        self.assertEqual(format_syringe_ml(ml or 0), "0.667")

    def test_mg_vial_rejects_iu_dose(self):
        ml, error = compute_syringe_ml("mg", 10, 2, "iu", 100)
        self.assertIsNone(ml)
        self.assertEqual(error, "incompatible")

    def test_iu_vial_rejects_mcg_dose(self):
        ml, error = compute_syringe_ml("iu", 1500, 2, "mcg", 250)
        self.assertIsNone(ml)
        self.assertEqual(error, "incompatible")

    def test_incomplete_when_water_is_zero(self):
        ml, error = compute_syringe_ml("mg", 10, 0, "mcg", 250)
        self.assertIsNone(ml)
        self.assertEqual(error, "incomplete")
