from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from cms.mailer import (
    bulk_profile,
    mail_channel_ready,
    profiles_for_send,
    resolve_recipients,
    transactional_profile,
)
from cms.peptide_calculator import compute_syringe_ml, format_syringe_ml


class PeptideCalculatorMathTests(SimpleTestCase):
    def test_default_mg_vial_mcg_dose(self):
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


def _settings(**overrides):
    base = dict(
        enabled=True,
        smtp_host="smtp.zoho.com",
        smtp_port=587,
        smtp_username="tx@example.com",
        smtp_password="tx-secret",
        use_tls=True,
        use_ssl=False,
        from_email="orders@example.com",
        from_name="Invictus Pharma",
        bulk_smtp_host="smtp.elasticemail.com",
        bulk_smtp_port=2525,
        bulk_smtp_username="bulk@example.com",
        bulk_smtp_password="bulk-secret",
        bulk_use_tls=True,
        bulk_use_ssl=False,
        bulk_from_email="news@example.com",
        bulk_from_name="Invictus News",
        fallback_transactional_to_bulk=False,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class DualSmtpRoutingTests(SimpleTestCase):
    def test_bulk_uses_bulk_host(self):
        settings = _settings()
        profile = bulk_profile(settings)
        self.assertEqual(profile.host, "smtp.elasticemail.com")
        self.assertEqual(profile.from_email, "news@example.com")
        self.assertEqual(profiles_for_send(settings, "bulk")[0].host, "smtp.elasticemail.com")

    def test_bulk_falls_back_to_transactional_when_empty(self):
        settings = _settings(bulk_smtp_host="")
        self.assertEqual(bulk_profile(settings).host, "smtp.zoho.com")

    def test_transactional_stays_on_primary_when_fallback_off(self):
        settings = _settings()
        profiles = profiles_for_send(settings, "transactional")
        self.assertEqual(len(profiles), 1)
        self.assertEqual(profiles[0].host, "smtp.zoho.com")

    def test_fallback_switch_retries_bulk_after_transactional(self):
        settings = _settings(fallback_transactional_to_bulk=True)
        profiles = profiles_for_send(settings, "transactional")
        self.assertEqual([row.host for row in profiles], ["smtp.zoho.com", "smtp.elasticemail.com"])

    def test_fallback_switch_uses_bulk_when_transactional_missing(self):
        settings = _settings(smtp_host="", fallback_transactional_to_bulk=True)
        profiles = profiles_for_send(settings, "transactional")
        self.assertEqual(len(profiles), 1)
        self.assertEqual(profiles[0].host, "smtp.elasticemail.com")
        self.assertTrue(mail_channel_ready(settings, "transactional"))

    def test_transactional_not_ready_without_host_or_fallback(self):
        settings = _settings(smtp_host="", fallback_transactional_to_bulk=False)
        self.assertFalse(mail_channel_ready(settings, "transactional"))
        self.assertEqual(transactional_profile(settings).configured, False)


def _template(**overrides):
    base = dict(
        notify_admin=False,
        notify_user=False,
        notify_warehouse_manager=False,
        custom_emails="",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _email_settings(**overrides):
    base = dict(
        extra_admin_emails="staff-extra@example.com",
        warehouse_1_emails="w1@example.com",
        warehouse_2_emails="w2@example.com",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class RecipientRulesTests(SimpleTestCase):
    def test_enabled_with_no_targets_sends_to_nobody(self):
        with patch("cms.mailer.User.objects.filter") as filtered:
            result = resolve_recipients(
                _template(),
                _email_settings(),
                user_email="customer@example.com",
            )
        self.assertEqual(result, [])
        filtered.assert_not_called()

    def test_custom_list_only_skips_admin_and_user(self):
        with patch("cms.mailer.User.objects.filter") as filtered:
            result = resolve_recipients(
                _template(custom_emails="inbox@invictuspharma.net"),
                _email_settings(),
                user_email="customer@example.com",
            )
        self.assertEqual(result, ["inbox@invictuspharma.net"])
        filtered.assert_not_called()

    def test_custom_plus_user_combines(self):
        with patch("cms.mailer.User.objects.filter") as filtered:
            result = resolve_recipients(
                _template(notify_user=True, custom_emails="inbox@invictuspharma.net"),
                _email_settings(),
                user_email="customer@example.com",
            )
        self.assertEqual(result, ["customer@example.com", "inbox@invictuspharma.net"])
        filtered.assert_not_called()
