from django.core.paginator import Paginator
from django.db.models import Count
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import User
from accounts.permissions import IsStoreStaff
from cms.bulk_email import (
    DEFAULT_CHUNK_SIZE,
    MAX_CHUNK_SIZE,
    MAX_RECIPIENTS,
    SAMPLE_SIZE,
    can_access_batch,
    collect_recipients,
    create_batch,
    default_template,
    heading_for,
    inner_html,
    merge_tokens,
    process_chunk,
    process_due_batches,
    reconcile_batch,
    save_draft,
    serialize_batch,
    serialize_draft,
)
from cms.models import BulkEmailBatch, BulkEmailDraft, BulkEmailRecipient


def _int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsStoreStaff])
def bulk_template_view(request):
    if request.method == "GET":
        draft = BulkEmailDraft.objects.filter(user=request.user).first()
        return Response(serialize_draft(draft))
    if request.method == "DELETE":
        BulkEmailDraft.objects.filter(user=request.user).delete()
        return Response(default_template())
    subject = (request.data.get("subject") or "").strip()
    title = (request.data.get("title") or "").strip()
    body = request.data.get("bodyHtml") or request.data.get("body_html") or ""
    if not subject:
        return Response({"error": "Subject is required."}, status=400)
    if not str(body).strip():
        return Response({"error": "Message body is required."}, status=400)
    draft = save_draft(request.user, subject, title, str(body))
    return Response(serialize_draft(draft))


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def bulk_preview_view(request):
    recipients = collect_recipients(request.user, request.data)
    if len(recipients) > MAX_RECIPIENTS:
        return Response(
            {"error": f"Too many recipients (max {MAX_RECIPIENTS}). Narrow your selection."},
            status=400,
        )
    return Response({"count": len(recipients), "sample": recipients[:SAMPLE_SIZE]})


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def bulk_render_preview_view(request):
    subject = (request.data.get("subject") or "").strip()
    title = (request.data.get("title") or "").strip()
    body = request.data.get("bodyHtml") or request.data.get("body_html") or ""
    name = (request.data.get("previewName") or request.data.get("preview_name") or "there").strip()
    email = (
        request.data.get("previewEmail") or request.data.get("preview_email") or "preview.recipient@example.com"
    ).strip()
    if not subject or not str(body).strip():
        return Response({"error": "Subject and body are required to preview."}, status=400)
    heading = heading_for(subject, title, name, email)
    return Response(
        {
            "subject": merge_tokens(subject, name, email),
            "html": inner_html(heading, merge_tokens(str(body), name, email)),
            "previewName": name,
            "previewEmail": email,
        }
    )


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def bulk_send_view(request):
    subject = (request.data.get("subject") or "").strip()
    title = (request.data.get("title") or "").strip()
    body = request.data.get("bodyHtml") or request.data.get("body_html") or ""
    if not subject:
        return Response({"error": "Subject is required."}, status=400)
    if len(subject) > 255:
        return Response({"error": "Subject must be 255 characters or less."}, status=400)
    if len(title) > 500:
        return Response({"error": "Title must be 500 characters or less."}, status=400)
    if not str(body).strip():
        return Response({"error": "Message body is required."}, status=400)
    if len(str(body)) > 100000:
        return Response({"error": "Message body is too long."}, status=400)
    recipients = collect_recipients(request.user, request.data)
    if not recipients:
        return Response({"error": "Preview recipients first and ensure at least one valid address."}, status=400)
    if len(recipients) > MAX_RECIPIENTS:
        return Response({"error": f"Too many recipients (max {MAX_RECIPIENTS})."}, status=400)
    chunk_size = max(1, min(MAX_CHUNK_SIZE, _int(request.data.get("chunkSize") or request.data.get("chunk_size"), DEFAULT_CHUNK_SIZE)))
    gap_minutes = max(1, min(1440, _int(request.data.get("chunkGapMinutes") or request.data.get("chunk_gap_minutes"), 5)))
    save_draft(request.user, subject, title, str(body))
    batch = create_batch(
        request.user,
        recipients,
        subject,
        title,
        str(body),
        chunk_size,
        gap_minutes * 60,
    )
    batch = reconcile_batch(batch)
    return Response(
        {
            "ok": True,
            "message": (
                f"Sending started. First burst of up to {batch.chunk_size} email(s) goes out now, "
                f"then every {max(1, round(batch.interval_seconds / 60))} minute(s)."
            ),
            "batchId": str(batch.id),
            "batch": serialize_batch(batch),
        },
        status=201,
    )


def _get_batch(request, pk) -> BulkEmailBatch | Response:
    batch = BulkEmailBatch.objects.filter(pk=pk).first()
    if not batch:
        return Response({"error": "Not found."}, status=404)
    if not can_access_batch(request.user, batch):
        return Response({"error": "Not found."}, status=404)
    return batch


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def bulk_batch_list_view(request):
    process_due_batches()
    qs = BulkEmailBatch.objects.all()
    if request.user.role != User.Role.SUPERUSER:
        qs = qs.filter(user=request.user)
    rows = []
    for batch in qs[:15]:
        if batch.status in (BulkEmailBatch.Status.RUNNING, BulkEmailBatch.Status.PAUSED):
            batch = reconcile_batch(batch)
        rows.append(serialize_batch(batch))
    return Response(rows)


@api_view(["GET", "DELETE"])
@permission_classes([IsStoreStaff])
def bulk_batch_detail_view(request, pk):
    batch = _get_batch(request, pk)
    if isinstance(batch, Response):
        return batch
    if request.method == "DELETE":
        if batch.status == BulkEmailBatch.Status.RUNNING:
            return Response({"error": "Pause or stop the batch before deleting it."}, status=400)
        batch.delete()
        return Response({"ok": True})
    process_due_batches()
    batch = reconcile_batch(BulkEmailBatch.objects.get(pk=pk))
    return Response(serialize_batch(batch))


@api_view(["GET"])
@permission_classes([IsStoreStaff])
def bulk_batch_recipients_view(request, pk):
    batch = _get_batch(request, pk)
    if isinstance(batch, Response):
        return batch
    status = (request.query_params.get("status") or "all").strip().lower()
    page = max(1, _int(request.query_params.get("page"), 1))
    per_page = max(1, min(100, _int(request.query_params.get("per_page") or request.query_params.get("perPage"), 50)))
    qs = batch.recipients.all()
    if status in {choice[0] for choice in BulkEmailRecipient.Status.choices}:
        qs = qs.filter(status=status)
    paginator = Paginator(qs, per_page)
    page_obj = paginator.get_page(page)
    counts = {
        BulkEmailRecipient.Status.PENDING: 0,
        BulkEmailRecipient.Status.SENT: 0,
        BulkEmailRecipient.Status.FAILED: 0,
    }
    for row in batch.recipients.values("status").annotate(total=Count("id")):
        counts[row["status"]] = row["total"]
    return Response(
        {
            "counts": {
                "pending": counts[BulkEmailRecipient.Status.PENDING],
                "sent": counts[BulkEmailRecipient.Status.SENT],
                "failed": counts[BulkEmailRecipient.Status.FAILED],
            },
            "recipients": [
                {
                    "id": str(item.id),
                    "email": item.email,
                    "name": item.name or None,
                    "status": item.status,
                    "errorMessage": item.error_message or None,
                    "processedAt": item.processed_at.isoformat() if item.processed_at else None,
                    "sortOrder": item.sort_order,
                }
                for item in page_obj.object_list
            ],
            "pagination": {
                "page": page_obj.number,
                "lastPage": paginator.num_pages or 1,
                "perPage": per_page,
                "total": paginator.count,
            },
        }
    )


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def bulk_batch_pause_view(request, pk):
    batch = _get_batch(request, pk)
    if isinstance(batch, Response):
        return batch
    if batch.status != BulkEmailBatch.Status.RUNNING:
        return Response({"error": "Only a sending batch can be paused."}, status=400)
    BulkEmailBatch.objects.filter(pk=batch.pk, status=BulkEmailBatch.Status.RUNNING).update(
        status=BulkEmailBatch.Status.PAUSED,
        last_error="",
    )
    return Response(serialize_batch(reconcile_batch(BulkEmailBatch.objects.get(pk=pk))))


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def bulk_batch_stop_view(request, pk):
    batch = _get_batch(request, pk)
    if isinstance(batch, Response):
        return batch
    if batch.status not in (BulkEmailBatch.Status.RUNNING, BulkEmailBatch.Status.PAUSED):
        return Response({"error": "Only a sending or paused batch can be stopped."}, status=400)
    BulkEmailBatch.objects.filter(pk=batch.pk).update(
        status=BulkEmailBatch.Status.STOPPED,
        next_send_at=None,
        last_error="Stopped by admin. Remaining recipients were not sent.",
    )
    return Response(serialize_batch(reconcile_batch(BulkEmailBatch.objects.get(pk=pk))))


@api_view(["POST"])
@permission_classes([IsStoreStaff])
def bulk_batch_resume_view(request, pk):
    batch = _get_batch(request, pk)
    if isinstance(batch, Response):
        return batch
    if not batch.subject_tpl or not batch.body_tpl:
        return Response(
            {"error": "This batch cannot be resumed because message templates were not stored."},
            status=400,
        )
    pending = batch.recipients.filter(status=BulkEmailRecipient.Status.PENDING).count()
    if pending == 0:
        return Response({"error": "No pending recipients remain for this batch."}, status=400)
    BulkEmailBatch.objects.filter(pk=batch.pk).update(
        status=BulkEmailBatch.Status.RUNNING,
        next_send_at=timezone.now(),
        last_error="",
    )
    process_chunk(BulkEmailBatch.objects.get(pk=pk))
    return Response(serialize_batch(reconcile_batch(BulkEmailBatch.objects.get(pk=pk))))
