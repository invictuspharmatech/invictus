from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from email.utils import formataddr
from html import escape, unescape
from typing import Any, Literal, assert_never

from django.core.mail import EmailMultiAlternatives, get_connection

from accounts.models import User
from cms.email_defaults import DEFAULT_TEMPLATES
from cms.email_wrapper import plain_to_html, wrap_email_body
from cms.models import EmailSettings, EmailTemplate

logger = logging.getLogger(__name__)

SITE_NAME = "Invictus Pharma"
TOKEN_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")
EMAIL_SPLIT_RE = re.compile(r"[\s,;]+")
TAG_RE = re.compile(r"<[^>]+>")
SmtpChannel = Literal["transactional", "bulk"]


@dataclass(frozen=True)
class SmtpProfile:
    channel: SmtpChannel
    host: str
    port: int
    username: str
    password: str
    use_tls: bool
    use_ssl: bool
    from_email: str
    from_name: str

    @property
    def configured(self) -> bool:
        return bool((self.host or "").strip())


def transactional_profile(settings: EmailSettings) -> SmtpProfile:
    return SmtpProfile(
        channel="transactional",
        host=(settings.smtp_host or "").strip(),
        port=int(settings.smtp_port or 587),
        username=settings.smtp_username or "",
        password=settings.smtp_password or "",
        use_tls=bool(settings.use_tls),
        use_ssl=bool(settings.use_ssl),
        from_email=(settings.from_email or "").strip(),
        from_name=(settings.from_name or "").strip(),
    )


def bulk_profile(settings: EmailSettings) -> SmtpProfile:
    host = (settings.bulk_smtp_host or "").strip()
    if not host:
        return transactional_profile(settings)
    return SmtpProfile(
        channel="bulk",
        host=host,
        port=int(settings.bulk_smtp_port or 2525),
        username=settings.bulk_smtp_username or "",
        password=settings.bulk_smtp_password or "",
        use_tls=bool(settings.bulk_use_tls),
        use_ssl=bool(settings.bulk_use_ssl),
        from_email=(settings.bulk_from_email or settings.from_email or "").strip(),
        from_name=(settings.bulk_from_name or settings.from_name or "").strip(),
    )


def _same_smtp(left: SmtpProfile, right: SmtpProfile) -> bool:
    return (
        left.host == right.host
        and left.port == right.port
        and left.username == right.username
        and left.password == right.password
    )


def mail_channel_ready(settings: EmailSettings, channel: SmtpChannel) -> bool:
    if not settings.enabled:
        return False
    if channel == "bulk":
        return bulk_profile(settings).configured
    if channel == "transactional":
        if transactional_profile(settings).configured:
            return True
        return bool(settings.fallback_transactional_to_bulk and bulk_profile(settings).configured)
    assert_never(channel)


def profiles_for_send(settings: EmailSettings, channel: SmtpChannel) -> list[SmtpProfile]:
    if channel == "bulk":
        return [bulk_profile(settings)]
    if channel == "transactional":
        transactional = transactional_profile(settings)
        bulk = bulk_profile(settings)
        if not settings.fallback_transactional_to_bulk:
            return [transactional]
        if not bulk.configured:
            return [transactional]
        if not transactional.configured:
            return [bulk]
        if _same_smtp(transactional, bulk):
            return [transactional]
        return [transactional, bulk]
    assert_never(channel)


STATUS_EVENTS = {
    "ON_HOLD": "order_on_hold",
    "PROCESSING": "order_processing",
    "COMPLETED": "order_shipped",
    "SHIPPED": "order_shipped",
    "DELIVERED": "order_delivered",
    "CANCELLED": "order_cancelled",
    "REFUNDED": "order_refunded",
    "FAILED": "order_failed",
    "PAID": "order_paid",
}


def get_email_settings() -> EmailSettings:
    settings, _ = EmailSettings.objects.get_or_create(pk=1)
    return settings


def ensure_default_templates() -> None:
    for index, item in enumerate(DEFAULT_TEMPLATES):
        EmailTemplate.objects.get_or_create(
            event_key=item["event_key"],
            defaults={
                "name": item["name"],
                "description": item["description"],
                "subject": item["subject"],
                "body": item["body"],
                "notify_admin": item["notify_admin"],
                "notify_user": item["notify_user"],
                "notify_warehouse_manager": item["notify_warehouse_manager"],
                "sort_order": item.get("sort_order", index),
                "enabled": True,
            },
        )


def parse_emails(value: str | None) -> list[str]:
    if not value:
        return []
    seen: set[str] = set()
    result: list[str] = []
    for part in EMAIL_SPLIT_RE.split(value):
        email = part.strip().lower()
        if not email or "@" not in email or email in seen:
            continue
        seen.add(email)
        result.append(email)
    return result


def render_tokens(text: str, context: dict[str, Any]) -> str:
    def replacer(match: re.Match[str]) -> str:
        key = match.group(1)
        value = context.get(key, "")
        return "" if value is None else str(value)

    return TOKEN_RE.sub(replacer, text)


def html_to_text(html: str) -> str:
    text = TAG_RE.sub(" ", html)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def warehouse_label(code: str | None) -> str:
    if code == "WAREHOUSE_1":
        return "Warehouse 1"
    if code == "WAREHOUSE_2":
        return "Warehouse 2"
    return code or ""


def order_context(order) -> dict[str, Any]:
    from orders.fulfillment import live_group_orders, payment_primary

    group = live_group_orders(order) or [order]
    primary = payment_primary(order)
    items = []
    merchandise_total = 0.0
    shipping_total = 0.0
    warehouses = []
    for row in group:
        items.extend(list(row.items.all()))
        merchandise_total += float(row.merchandise_total or 0)
        shipping_total += float(row.shipping_total or 0)
        if row.warehouse not in warehouses:
            warehouses.append(row.warehouse)
    pay_now_url = ""
    pay_now_html = ""
    try:
        from orders.pay_token import checkout_url, order_may_pay

        if order_may_pay(primary):
            pay_now_url = checkout_url(primary)
            safe_url = escape(pay_now_url, quote=True)
            # Same pattern as GreatLife: branded button, no raw URL text in the body.
            pay_now_html = (
                '<div style="margin:20px 0 16px;padding:16px 18px;border-radius:12px;'
                "background:rgba(139,26,26,0.08);border:1px solid rgba(196,160,106,0.45);\">"
                '<p style="margin:0 0 12px;line-height:1.5;color:#610c0d;font-size:15px;font-weight:600;">'
                "Pay with Bitcoin</p>"
                '<p style="margin:0 0 14px;line-height:1.55;color:#3a1414;font-size:14px;">'
                "Open the invoice on our site and complete payment there "
                "(no raw payment URL in this email).</p>"
                f'<a href="{safe_url}" style="display:inline-block;background:#8B1A1A;'
                "color:#ffffff!important;text-decoration:none;padding:12px 22px;"
                'border-radius:10px;font-weight:600;font-size:14px;">Pay now</a>'
                "</div>"
            )
    except Exception:
        pay_now_url = ""
        pay_now_html = ""
    grand_total = merchandise_total + shipping_total
    tracking_number, tracking_url, tracking_html = _tracking_context(order)
    notify_email = order_notify_email(order)
    return {
        "site_name": SITE_NAME,
        "order_number": primary.group_id or order.order_number,
        "customer_name": order.customer_name,
        "customer_email": notify_email,
        "user_name": order.customer_name,
        "user_email": notify_email,
        "status": primary.status,
        "warehouse": " / ".join(warehouse_label(code) for code in warehouses) or warehouse_label(order.warehouse),
        "warehouse_code": primary.warehouse,
        "grand_total": f"{grand_total:.2f}",
        "merchandise_total": f"{merchandise_total:.2f}",
        "shipping_total": f"{shipping_total:.2f}",
        "items": ", ".join(f"{item.name} × {item.quantity}" for item in items),
        "pay_now_url": pay_now_url,
        "pay_now_html": pay_now_html,
        "tracking_number": tracking_number,
        "tracking_url": tracking_url,
        "tracking_html": tracking_html,
        "shipping_address": ", ".join(
            part
            for part in [
                order.shipping_line1,
                order.shipping_line2,
                order.shipping_city,
                order.shipping_state,
                order.shipping_postal,
            ]
            if part
        ),
    }


def order_notify_email(order) -> str:
    """Prefer the linked account email (checkout is locked to it); fall back to order email."""
    user = getattr(order, "user", None)
    account = (getattr(user, "email", None) or "").strip()
    if account:
        return account
    return (order.customer_email or "").strip()


def _tracking_context(order) -> tuple[str, str, str]:
    tracking = (order.tracking_number or "").strip()
    url = ""
    label = None
    labels = list(order.shipping_labels.all()) if hasattr(order, "shipping_labels") else []
    if labels:
        # Prefer the newest label that has a tracking number.
        for row in sorted(labels, key=lambda item: item.created_at or timezone_min(), reverse=True):
            if (row.tracking_number or "").strip():
                label = row
                break
        if label is None and labels:
            label = sorted(labels, key=lambda item: item.created_at or timezone_min(), reverse=True)[0]
    if label:
        tracking = tracking or (label.tracking_number or "").strip()
        url = (label.tracking_url or "").strip()
    if tracking and not url:
        try:
            from orders.bitcoinpostage import tracking_url_for

            url = tracking_url_for("USPS", tracking)
        except Exception:
            url = ""
    if not tracking:
        return "", "", ""
    safe_number = escape(tracking)
    if url:
        safe_url = escape(url, quote=True)
        html = (
            '<div style="margin:16px 0;padding:14px 16px;border-radius:10px;'
            "background:rgba(139,26,26,0.06);border:1px solid rgba(196,160,106,0.4);\">"
            f'<p style="margin:0 0 10px;color:#610c0d;font-weight:600;">Tracking number: {safe_number}</p>'
            f'<a href="{safe_url}" style="display:inline-block;background:#8B1A1A;color:#ffffff!important;'
            "text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px;\">"
            "Track package</a></div>"
        )
    else:
        html = f"<p>Tracking number: <strong>{safe_number}</strong></p>"
    return tracking, url, html


def timezone_min():
    from datetime import datetime
    from zoneinfo import ZoneInfo

    return datetime(1970, 1, 1, tzinfo=ZoneInfo("UTC"))


def resolve_recipients(
    template: EmailTemplate,
    settings: EmailSettings,
    *,
    user_email: str | None = None,
    warehouse: str | None = None,
) -> list[str]:
    """Build the To: list strictly from template recipient choices.

    Rules:
    - Enabled template with no boxes checked and empty custom list → nobody (no send).
    - Custom list only → only those addresses (never default admin/customer/warehouse).
    - Checked boxes + custom list → union of all selected targets.
    - Checked boxes alone → only those role targets.
    """
    recipients: list[str] = []
    if template.notify_admin:
        staff_emails = User.objects.filter(
            role__in=[User.Role.ADMIN, User.Role.SUPERUSER],
            is_active=True,
        ).values_list("email", flat=True)
        recipients.extend(staff_emails)
        recipients.extend(parse_emails(settings.extra_admin_emails))
    if template.notify_user and user_email:
        recipients.extend(parse_emails(user_email))
    if template.notify_warehouse_manager:
        if warehouse == "WAREHOUSE_1":
            recipients.extend(parse_emails(settings.warehouse_1_emails))
        elif warehouse == "WAREHOUSE_2":
            recipients.extend(parse_emails(settings.warehouse_2_emails))
        else:
            recipients.extend(parse_emails(settings.warehouse_1_emails))
            recipients.extend(parse_emails(settings.warehouse_2_emails))
    # Manual list is additive only — never implies admin/user defaults.
    recipients.extend(parse_emails(template.custom_emails))
    return parse_emails(",".join(recipients))


def smtp_connection(profile: SmtpProfile):
    return get_connection(
        backend="django.core.mail.backends.smtp.EmailBackend",
        host=profile.host,
        port=profile.port,
        username=profile.username or None,
        password=profile.password or None,
        use_tls=profile.use_tls,
        use_ssl=profile.use_ssl,
        fail_silently=False,
    )


def _deliver(
    settings: EmailSettings,
    profile: SmtpProfile,
    *,
    to: list[str],
    subject: str,
    html_body: str,
    reply_to: str | None = None,
) -> int:
    from_email = profile.from_email or profile.username
    if not from_email:
        raise ValueError("From email is required.")
    sender = formataddr((profile.from_name or SITE_NAME, from_email))
    wrapped = wrap_email_body(plain_to_html(html_body), settings.wrapper_html)
    text_body = html_to_text(wrapped)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=sender,
        to=to,
        reply_to=[reply_to] if reply_to else None,
        connection=smtp_connection(profile),
    )
    message.attach_alternative(wrapped, "text/html")
    return message.send()


def send_message(
    settings: EmailSettings,
    *,
    to: list[str],
    subject: str,
    html_body: str,
    channel: SmtpChannel = "transactional",
    reply_to: str | None = None,
) -> int:
    if not to:
        return 0
    profiles = profiles_for_send(settings, channel)
    last_error: Exception | None = None
    for index, profile in enumerate(profiles):
        if not profile.configured:
            last_error = ValueError("SMTP host is required.")
            continue
        try:
            return _deliver(
                settings,
                profile,
                to=to,
                subject=subject,
                html_body=html_body,
                reply_to=reply_to,
            )
        except Exception as exc:
            last_error = exc
            if index < len(profiles) - 1:
                logger.warning(
                    "Transactional SMTP failed; sending through bulk SMTP instead: %s",
                    exc,
                )
                continue
            raise
    raise last_error or ValueError("SMTP host is required.")


def send_event(
    event_key: str,
    context: dict[str, Any] | None = None,
    *,
    user_email: str | None = None,
    warehouse: str | None = None,
    reply_to: str | None = None,
) -> None:
    context = {"site_name": SITE_NAME, **(context or {})}
    try:
        ensure_default_templates()
        settings = get_email_settings()
        if not mail_channel_ready(settings, "transactional"):
            return
        template = EmailTemplate.objects.filter(event_key=event_key, enabled=True).first()
        if not template:
            return
        recipients = resolve_recipients(
            template,
            settings,
            user_email=user_email or context.get("user_email") or context.get("customer_email"),
            warehouse=warehouse or context.get("warehouse_code"),
        )
        if not recipients:
            # Enabled alone is not enough — need at least one checked role or a custom address.
            logger.info(
                "Skipping %s email: no recipients (unchecked roles and empty custom list).",
                event_key,
            )
            return
        subject = render_tokens(template.subject, context)
        body = render_tokens(template.body, context)
        send_message(
            settings,
            to=recipients,
            subject=subject,
            html_body=body,
            channel="transactional",
            reply_to=reply_to,
        )
    except Exception:
        logger.exception("Failed to send %s email", event_key)


def send_order_event(event_key: str, order) -> None:
    context = order_context(order)
    send_event(
        event_key,
        context,
        user_email=context.get("customer_email") or order_notify_email(order),
        warehouse=order.warehouse,
    )


def send_order_status_event(order) -> None:
    event_key = STATUS_EVENTS.get(order.status)
    if event_key:
        send_order_event(event_key, order)


def send_test_email(to_email: str, channel: SmtpChannel = "transactional") -> None:
    settings = get_email_settings()
    if not settings.enabled:
        raise ValueError("Email sending is disabled.")
    if channel == "bulk":
        label = "bulk"
    elif channel == "transactional":
        label = "transactional"
    else:
        assert_never(channel)
    if not mail_channel_ready(settings, channel):
        raise ValueError(f"{label.capitalize()} SMTP is not configured.")
    recipients = parse_emails(to_email)
    if not recipients:
        raise ValueError("A valid test recipient is required.")
    send_message(
        settings,
        to=recipients,
        subject=f"{SITE_NAME} {label} test email",
        html_body=f"<p>This is a {label} SMTP test email from {SITE_NAME}.</p>",
        channel=channel,
    )
