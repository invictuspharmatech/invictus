from __future__ import annotations

import logging
import re
from email.utils import formataddr
from html import unescape
from typing import Any

from django.core.mail import EmailMultiAlternatives, get_connection

from accounts.models import User
from cms.email_defaults import DEFAULT_TEMPLATES
from cms.models import EmailSettings, EmailTemplate

logger = logging.getLogger(__name__)

SITE_NAME = "Invictus Pharma"
TOKEN_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")
EMAIL_SPLIT_RE = re.compile(r"[\s,;]+")
TAG_RE = re.compile(r"<[^>]+>")

STATUS_EVENTS = {
    "PROCESSING": "order_processing",
    "SHIPPED": "order_shipped",
    "DELIVERED": "order_delivered",
    "CANCELLED": "order_cancelled",
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
    items = list(order.items.all())
    return {
        "site_name": SITE_NAME,
        "order_number": order.order_number,
        "customer_name": order.customer_name,
        "customer_email": order.customer_email,
        "user_name": order.customer_name,
        "user_email": order.customer_email,
        "status": order.status,
        "warehouse": warehouse_label(order.warehouse),
        "warehouse_code": order.warehouse,
        "grand_total": f"{order.grand_total:.2f}",
        "merchandise_total": f"{order.merchandise_total:.2f}",
        "shipping_total": f"{order.shipping_total:.2f}",
        "items": ", ".join(f"{item.name} × {item.quantity}" for item in items),
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


def resolve_recipients(
    template: EmailTemplate,
    settings: EmailSettings,
    *,
    user_email: str | None = None,
    warehouse: str | None = None,
) -> list[str]:
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
    recipients.extend(parse_emails(template.custom_emails))
    return parse_emails(",".join(recipients))


def smtp_connection(settings: EmailSettings):
    return get_connection(
        backend="django.core.mail.backends.smtp.EmailBackend",
        host=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_username or None,
        password=settings.smtp_password or None,
        use_tls=settings.use_tls,
        use_ssl=settings.use_ssl,
        fail_silently=False,
    )


def send_message(
    settings: EmailSettings,
    *,
    to: list[str],
    subject: str,
    html_body: str,
) -> int:
    if not to:
        return 0
    from_email = settings.from_email or settings.smtp_username
    if not from_email:
        raise ValueError("From email is required.")
    sender = formataddr((settings.from_name or SITE_NAME, from_email))
    text_body = html_to_text(html_body)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=sender,
        to=to,
        connection=smtp_connection(settings),
    )
    message.attach_alternative(html_body, "text/html")
    return message.send()


def send_event(
    event_key: str,
    context: dict[str, Any] | None = None,
    *,
    user_email: str | None = None,
    warehouse: str | None = None,
) -> None:
    context = {"site_name": SITE_NAME, **(context or {})}
    try:
        ensure_default_templates()
        settings = get_email_settings()
        if not settings.enabled or not settings.smtp_host:
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
            return
        subject = render_tokens(template.subject, context)
        body = render_tokens(template.body, context)
        send_message(settings, to=recipients, subject=subject, html_body=body)
    except Exception:
        logger.exception("Failed to send %s email", event_key)


def send_order_event(event_key: str, order) -> None:
    send_event(
        event_key,
        order_context(order),
        user_email=order.customer_email,
        warehouse=order.warehouse,
    )


def send_order_status_event(order) -> None:
    event_key = STATUS_EVENTS.get(order.status)
    if event_key:
        send_order_event(event_key, order)


def send_test_email(to_email: str) -> None:
    settings = get_email_settings()
    if not settings.enabled:
        raise ValueError("Email sending is disabled.")
    if not settings.smtp_host:
        raise ValueError("SMTP host is required.")
    recipients = parse_emails(to_email)
    if not recipients:
        raise ValueError("A valid test recipient is required.")
    send_message(
        settings,
        to=recipients,
        subject=f"{SITE_NAME} test email",
        html_body=f"<p>This is a test email from {SITE_NAME}.</p>",
    )
