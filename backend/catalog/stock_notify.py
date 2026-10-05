from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.db.models import F
from django.utils import timezone

from catalog.models import Product, ProductStockSubscription, StockNotificationBatch, StockNotificationRecipient
from cms.mailer import ensure_default_templates, get_email_settings, render_tokens, send_message
from cms.models import EmailTemplate

CHUNK_SIZE = 20
CHUNK_GAP_SECONDS = 300


def product_accepts_notify(product: Product) -> bool:
    qty = int(product.stock_quantity or 0)
    status = (product.stock_status or "").lower().replace("-", "_")
    return status in ("outofstock", "out_of_stock") or qty <= 0


def subscribe(product: Product, email: str, name: str = "", user=None) -> ProductStockSubscription:
    cleaned = (email or "").strip().lower()
    if not cleaned or "@" not in cleaned:
        raise ValueError("A valid email is required.")
    if not product_accepts_notify(product):
        raise ValueError("This product is already in stock.")
    row, _ = ProductStockSubscription.objects.update_or_create(
        product=product,
        email=cleaned,
        defaults={
            "name": (name or "").strip(),
            "user": user,
            "status": ProductStockSubscription.Status.ACTIVE,
            "notified_at": None,
        },
    )
    return row


def unsubscribe(product: Product, email: str) -> None:
    ProductStockSubscription.objects.filter(
        product=product, email=(email or "").strip().lower()
    ).update(status=ProductStockSubscription.Status.CANCELLED)


def subscription_status(product: Product, email: str) -> dict:
    row = ProductStockSubscription.objects.filter(
        product=product, email=(email or "").strip().lower()
    ).first()
    return {
        "subscribed": bool(row and row.status == ProductStockSubscription.Status.ACTIVE),
        "status": row.status if row else None,
    }


def dispatch_for_product(product: Product) -> StockNotificationBatch | None:
    qty = int(product.stock_quantity or 0)
    status = (product.stock_status or "").lower()
    if qty <= 0 or status in ("outofstock", "out_of_stock"):
        return None
    if StockNotificationBatch.objects.filter(
        product=product,
        status__in=[StockNotificationBatch.Status.RUNNING, StockNotificationBatch.Status.PAUSED],
    ).exists():
        return None
    subs = list(
        ProductStockSubscription.objects.filter(
            product=product, status=ProductStockSubscription.Status.ACTIVE
        )
    )
    if not subs:
        return None
    ensure_default_templates()
    template = EmailTemplate.objects.filter(event_key="product_in_stock", enabled=True).first()
    batch = StockNotificationBatch.objects.create(
        product=product,
        subject_tpl=(template.subject if template else "{{product_name}} is back in stock"),
        body_tpl=(
            template.body
            if template
            else "<p>{{product_name}} is back in stock. <a href=\"{{product_url}}\">View product</a></p>"
        ),
        chunk_size=CHUNK_SIZE,
        interval_seconds=CHUNK_GAP_SECONDS,
        next_send_at=timezone.now(),
    )
    for index, sub in enumerate(subs):
        StockNotificationRecipient.objects.create(
            batch=batch,
            subscription=sub,
            email=sub.email,
            name=sub.name or sub.email.split("@")[0],
            sort_order=index,
        )
    process_chunk(batch)
    return batch


def maybe_dispatch_restock(product: Product, previous_status: str) -> None:
    prev = (previous_status or "").lower().replace("-", "_")
    current = (product.stock_status or "").lower().replace("-", "_")
    if prev in ("outofstock", "out_of_stock") and current in ("instock", "in_stock"):
        dispatch_for_product(product)


def serialize_batch(batch: StockNotificationBatch) -> dict:
    pending = batch.recipients.filter(status=StockNotificationRecipient.Status.PENDING).count()
    return {
        "id": str(batch.id),
        "productId": str(batch.product_id),
        "productName": batch.product.name,
        "status": batch.status,
        "sentCount": batch.sent_count,
        "failedCount": batch.failed_count,
        "pendingCount": pending,
        "lastError": batch.last_error,
        "nextSendAt": batch.next_send_at.isoformat() if batch.next_send_at else None,
        "createdAt": batch.created_at.isoformat() if batch.created_at else None,
    }


def process_chunk(batch: StockNotificationBatch) -> int:
    fresh = StockNotificationBatch.objects.filter(pk=batch.pk).first()
    if not fresh or fresh.status != StockNotificationBatch.Status.RUNNING:
        return 0
    chunk_size = max(1, int(fresh.chunk_size or CHUNK_SIZE))
    gap = max(60, int(fresh.interval_seconds or CHUNK_GAP_SECONDS))
    pending = list(
        fresh.recipients.filter(status=StockNotificationRecipient.Status.PENDING).order_by(
            "sort_order", "id"
        )[:chunk_size]
    )
    attempted = 0
    for recipient in pending:
        current = StockNotificationBatch.objects.filter(pk=fresh.pk).first()
        if not current or current.status != StockNotificationBatch.Status.RUNNING:
            break
        try:
            _send_one(current, recipient)
            recipient.status = StockNotificationRecipient.Status.SENT
            recipient.error_message = ""
            recipient.processed_at = timezone.now()
            recipient.save(update_fields=["status", "error_message", "processed_at"])
            StockNotificationBatch.objects.filter(pk=fresh.pk).update(sent_count=F("sent_count") + 1)
            if recipient.subscription_id:
                ProductStockSubscription.objects.filter(pk=recipient.subscription_id).update(
                    status=ProductStockSubscription.Status.NOTIFIED,
                    notified_at=timezone.now(),
                )
        except Exception as exc:
            recipient.status = StockNotificationRecipient.Status.FAILED
            recipient.error_message = str(exc)
            recipient.processed_at = timezone.now()
            recipient.save(update_fields=["status", "error_message", "processed_at"])
            StockNotificationBatch.objects.filter(pk=fresh.pk).update(
                failed_count=F("failed_count") + 1,
                last_error=str(exc),
            )
        attempted += 1
    has_more = fresh.recipients.filter(status=StockNotificationRecipient.Status.PENDING).exists()
    StockNotificationBatch.objects.filter(pk=fresh.pk).update(
        next_send_at=timezone.now() + timedelta(seconds=gap) if has_more else None,
        status=StockNotificationBatch.Status.RUNNING if has_more else StockNotificationBatch.Status.COMPLETED,
        last_error="" if not has_more else (StockNotificationBatch.objects.get(pk=fresh.pk).last_error or ""),
    )
    return attempted


def process_due_batches() -> int:
    total = 0
    due = StockNotificationBatch.objects.filter(
        status=StockNotificationBatch.Status.RUNNING,
        next_send_at__lte=timezone.now(),
    )
    for batch in due:
        total += process_chunk(batch)
    return total


def _send_one(batch: StockNotificationBatch, recipient: StockNotificationRecipient) -> None:
    mail = get_email_settings()
    if not mail.enabled or not mail.smtp_host:
        raise ValueError("Email sending is disabled or SMTP is not configured.")
    base = settings.PUBLIC_SITE_URL.rstrip("/")
    context = {
        "customer_name": recipient.name or "there",
        "product_name": batch.product.name,
        "product_url": f"{base}/products/{batch.product.slug}",
        "stock_message": "You asked us to email you when this item returned.",
        "site_name": "Invictus Pharma",
    }
    subject = render_tokens(batch.subject_tpl, context)
    body = render_tokens(batch.body_tpl, context)
    send_message(mail, to=[recipient.email], subject=subject, html_body=body)
