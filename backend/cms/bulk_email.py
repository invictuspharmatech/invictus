from __future__ import annotations

import csv
import io
import uuid
from datetime import timedelta
from html import escape
from typing import Any

from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone

from accounts.models import User
from cms.mailer import get_email_settings, send_message
from cms.models import BulkEmailBatch, BulkEmailDraft, BulkEmailRecipient

DEFAULT_SUBJECT = "A message from Invictus Pharma"
DEFAULT_TITLE = ""
DEFAULT_BODY = """<p>Dear {{recipient_name}},</p>
<p>We wanted to reach out with a brief update. If you have any questions, simply reply to this email.</p>
<p>Thank you for your continued trust.</p>
<p>— Invictus Pharma</p>"""

MAX_RECIPIENTS = 2000
MAX_CHUNK_SIZE = 100
DEFAULT_CHUNK_SIZE = 20
DEFAULT_CHUNK_GAP_SECONDS = 300
SAMPLE_SIZE = 15


def default_template() -> dict[str, Any]:
    return {
        "subject": DEFAULT_SUBJECT,
        "title": DEFAULT_TITLE,
        "bodyHtml": DEFAULT_BODY,
        "isSaved": False,
        "savedAt": None,
    }


def serialize_draft(draft: BulkEmailDraft | None) -> dict[str, Any]:
    if not draft:
        return default_template()
    return {
        "subject": draft.subject or DEFAULT_SUBJECT,
        "title": draft.title or "",
        "bodyHtml": draft.body_html or DEFAULT_BODY,
        "isSaved": True,
        "savedAt": draft.saved_at.isoformat() if draft.saved_at else None,
    }


def save_draft(user: User, subject: str, title: str, body_html: str) -> BulkEmailDraft:
    draft, _ = BulkEmailDraft.objects.update_or_create(
        user=user,
        defaults={
            "subject": subject[:255],
            "title": title[:500],
            "body_html": body_html,
        },
    )
    return draft


def parse_address_line(line: str) -> tuple[str, str]:
    text = (line or "").strip()
    if not text or text.startswith("#"):
        return "", ""
    reader = csv.reader(io.StringIO(text))
    try:
        parts = next(reader)
    except StopIteration:
        return "", ""
    cleaned = [part.strip().strip('"') for part in parts]
    first = cleaned[0] if cleaned else ""
    second = cleaned[1] if len(cleaned) > 1 else ""
    if "@" in first:
        return first.lower(), second
    if "@" in second:
        return second.lower(), first
    return "", ""


def parse_text_addresses(text: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for line in (text or "").splitlines():
        email, name = parse_address_line(line)
        if email:
            rows.append({"email": email, "name": name})
    return rows


def add_recipient(bucket: dict[str, dict[str, str]], email: str, name: str | None) -> None:
    cleaned = (email or "").strip().lower()
    if not cleaned or "@" not in cleaned or cleaned in bucket:
        return
    display = (name or "").strip()
    bucket[cleaned] = {"email": cleaned, "name": display}


def visible_users(actor: User):
    qs = User.objects.exclude(email="").filter(is_active=True)
    if actor.role != User.Role.SUPERUSER:
        qs = qs.exclude(role=User.Role.SUPERUSER)
    return qs


def collect_recipients(actor: User, data: dict) -> list[dict[str, str]]:
    bucket: dict[str, dict[str, str]] = {}
    select_all = bool(data.get("selectAllUsers") or data.get("select_all_users"))
    search = (data.get("userSearch") or data.get("user_search") or "").strip()
    if select_all:
        qs = visible_users(actor)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(email__icontains=search))
        for user in qs.only("email", "name"):
            add_recipient(bucket, user.email, user.name)
    raw_ids = data.get("userIds") or data.get("user_ids") or []
    if isinstance(raw_ids, str):
        raw_ids = [raw_ids]
    ids = []
    for item in raw_ids:
        try:
            ids.append(uuid.UUID(str(item)))
        except (TypeError, ValueError):
            continue
    if ids:
        qs = visible_users(actor).filter(pk__in=ids)
        for user in qs.only("email", "name"):
            add_recipient(bucket, user.email, user.name)
    for row in parse_text_addresses(data.get("manualEmails") or data.get("manual_emails") or ""):
        add_recipient(bucket, row["email"], row["name"])
    for row in parse_text_addresses(data.get("csvText") or data.get("csv_text") or ""):
        add_recipient(bucket, row["email"], row["name"])
    return list(bucket.values())


def merge_tokens(text: str, name: str, email: str) -> str:
    display = name.strip() if name and name.strip() else "there"
    return (
        (text or "")
        .replace("{{recipient_name}}", display)
        .replace("{{recipient_email}}", email)
    )


def heading_for(subject_tpl: str, title_tpl: str, name: str, email: str) -> str:
    title = merge_tokens(title_tpl, name, email).strip()
    if title:
        return title
    return merge_tokens(subject_tpl, name, email).strip()


def inner_html(title: str, body: str) -> str:
    return (
        '<div style="font-family:system-ui,Segoe UI,sans-serif;color:#1c1917;line-height:1.6;">'
        f'<h1 style="font-size:22px;margin:0 0 16px;color:#8B0000;">{escape(title)}</h1>'
        f'<div class="bulk-body">{body}</div>'
        "</div>"
    )


def serialize_batch(batch: BulkEmailBatch) -> dict[str, Any]:
    counts = batch.recipients.values("status").annotate(total=Count("id"))
    tally = {row["status"]: row["total"] for row in counts}
    pending = tally.get(BulkEmailRecipient.Status.PENDING, 0)
    sent = tally.get(BulkEmailRecipient.Status.SENT, 0)
    failed = tally.get(BulkEmailRecipient.Status.FAILED, 0)
    has_rows = pending + sent + failed > 0
    processed = sent + failed
    status = batch.status
    can_resume = (
        has_rows
        and pending > 0
        and status
        in (
            BulkEmailBatch.Status.PAUSED,
            BulkEmailBatch.Status.STOPPED,
            BulkEmailBatch.Status.INTERRUPTED,
        )
        and bool(batch.subject_tpl and batch.body_tpl)
    )
    can_pause = status == BulkEmailBatch.Status.RUNNING and pending > 0 and has_rows
    can_stop = status in (BulkEmailBatch.Status.RUNNING, BulkEmailBatch.Status.PAUSED) and pending > 0
    gap = max(60, int(batch.interval_seconds or DEFAULT_CHUNK_GAP_SECONDS))
    return {
        "id": str(batch.id),
        "totalCount": batch.total_count,
        "sentCount": sent if has_rows else batch.sent_count,
        "failedCount": failed if has_rows else batch.failed_count,
        "pendingCount": pending,
        "processed": processed,
        "lastRecipientEmail": batch.last_recipient_email or None,
        "status": batch.status,
        "subjectPreview": batch.subject_preview or None,
        "lastError": batch.last_error or None,
        "chunkSize": max(1, batch.chunk_size or 1),
        "chunkGapMinutes": max(1, round(gap / 60)),
        "intervalSeconds": gap,
        "nextSendAt": batch.next_send_at.isoformat() if batch.next_send_at else None,
        "canResume": can_resume,
        "canPause": can_pause,
        "canStop": can_stop,
        "hasRecipientTracking": has_rows,
        "createdAt": batch.created_at.isoformat() if batch.created_at else None,
        "updatedAt": batch.updated_at.isoformat() if batch.updated_at else None,
    }


def can_access_batch(actor: User, batch: BulkEmailBatch) -> bool:
    return actor.role == User.Role.SUPERUSER or batch.user_id == actor.id


def reconcile_batch(batch: BulkEmailBatch) -> BulkEmailBatch:
    pending = batch.recipients.filter(status=BulkEmailRecipient.Status.PENDING).count()
    sent = batch.recipients.filter(status=BulkEmailRecipient.Status.SENT).count()
    failed = batch.recipients.filter(status=BulkEmailRecipient.Status.FAILED).count()
    update = {"sent_count": sent, "failed_count": failed}
    if pending == 0 and batch.status != BulkEmailBatch.Status.STOPPED:
        update["status"] = BulkEmailBatch.Status.COMPLETED
        update["next_send_at"] = None
        update["last_error"] = ""
    BulkEmailBatch.objects.filter(pk=batch.pk).update(**update)
    return BulkEmailBatch.objects.get(pk=batch.pk)


def send_one(batch: BulkEmailBatch, recipient: BulkEmailRecipient) -> None:
    settings = get_email_settings()
    if not settings.enabled or not settings.smtp_host:
        raise ValueError("Email sending is disabled or SMTP is not configured.")
    subject = merge_tokens(batch.subject_tpl, recipient.name, recipient.email)
    title = heading_for(batch.subject_tpl, batch.title_tpl, recipient.name, recipient.email)
    body = merge_tokens(batch.body_tpl, recipient.name, recipient.email)
    send_message(
        settings,
        to=[recipient.email],
        subject=subject,
        html_body=inner_html(title, body),
    )


def process_chunk(batch: BulkEmailBatch) -> int:
    batch = BulkEmailBatch.objects.filter(pk=batch.pk).first()
    if not batch or batch.status != BulkEmailBatch.Status.RUNNING:
        return 0
    if not batch.subject_tpl or not batch.body_tpl:
        BulkEmailBatch.objects.filter(pk=batch.pk).update(
            status=BulkEmailBatch.Status.STOPPED,
            last_error="Batch templates are missing; cannot continue.",
        )
        return 0
    chunk_size = max(1, min(MAX_CHUNK_SIZE, int(batch.chunk_size or 1)))
    gap = max(60, int(batch.interval_seconds or DEFAULT_CHUNK_GAP_SECONDS))
    attempted = 0
    last_email = batch.last_recipient_email
    pending = list(
        batch.recipients.filter(status=BulkEmailRecipient.Status.PENDING).order_by("sort_order", "id")[:chunk_size]
    )
    for recipient in pending:
        current = BulkEmailBatch.objects.filter(pk=batch.pk).first()
        if not current or current.status != BulkEmailBatch.Status.RUNNING:
            break
        try:
            send_one(current, recipient)
            recipient.status = BulkEmailRecipient.Status.SENT
            recipient.error_message = ""
            recipient.processed_at = timezone.now()
            recipient.save(update_fields=["status", "error_message", "processed_at"])
            BulkEmailBatch.objects.filter(pk=batch.pk).update(sent_count=F("sent_count") + 1)
        except Exception as exc:
            recipient.status = BulkEmailRecipient.Status.FAILED
            recipient.error_message = str(exc)
            recipient.processed_at = timezone.now()
            recipient.save(update_fields=["status", "error_message", "processed_at"])
            BulkEmailBatch.objects.filter(pk=batch.pk).update(
                failed_count=F("failed_count") + 1,
                last_error=str(exc),
            )
        attempted += 1
        last_email = recipient.email
    if attempted == 0:
        BulkEmailBatch.objects.filter(pk=batch.pk).update(
            status=BulkEmailBatch.Status.COMPLETED,
            next_send_at=None,
            last_error="",
        )
        return 0
    has_more = batch.recipients.filter(status=BulkEmailRecipient.Status.PENDING).exists()
    fresh = BulkEmailBatch.objects.get(pk=batch.pk)
    BulkEmailBatch.objects.filter(pk=batch.pk).update(
        last_recipient_email=last_email or "",
        next_send_at=timezone.now() + timedelta(seconds=gap) if has_more else None,
        status=BulkEmailBatch.Status.RUNNING if has_more else BulkEmailBatch.Status.COMPLETED,
        last_error="" if not has_more else (fresh.last_error or ""),
    )
    return attempted


def process_due_batches() -> int:
    sent = 0
    now = timezone.now()
    due = BulkEmailBatch.objects.filter(status=BulkEmailBatch.Status.RUNNING).filter(
        Q(next_send_at__isnull=True) | Q(next_send_at__lte=now)
    ).order_by("next_send_at", "created_at")
    for batch in due:
        sent += process_chunk(batch)
    return sent


def create_batch(
    actor: User,
    recipients: list[dict[str, str]],
    subject: str,
    title: str,
    body_html: str,
    chunk_size: int,
    gap_seconds: int,
) -> BulkEmailBatch:
    chunk_size = max(1, min(MAX_CHUNK_SIZE, chunk_size))
    gap_seconds = max(60, gap_seconds)
    with transaction.atomic():
        batch = BulkEmailBatch.objects.create(
            user=actor,
            total_count=len(recipients),
            status=BulkEmailBatch.Status.RUNNING,
            subject_preview=subject[:255],
            subject_tpl=subject,
            title_tpl=title,
            body_tpl=body_html,
            interval_seconds=gap_seconds,
            chunk_size=chunk_size,
            next_send_at=timezone.now(),
        )
        BulkEmailRecipient.objects.bulk_create(
            [
                BulkEmailRecipient(
                    batch=batch,
                    sort_order=index,
                    email=row["email"],
                    name=row.get("name") or "",
                )
                for index, row in enumerate(recipients)
            ],
            batch_size=500,
        )
    process_chunk(batch)
    return BulkEmailBatch.objects.get(pk=batch.pk)
