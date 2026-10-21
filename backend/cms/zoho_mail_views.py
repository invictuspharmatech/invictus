from django.http import HttpResponseRedirect
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsPortalStaff, is_full_admin
from cms import zoho_mail


def _forbid(request):
    if not is_full_admin(request.user):
        return Response({"error": "Not allowed."}, status=403)
    return None


@api_view(["GET"])
@permission_classes([AllowAny])
def zoho_oauth_callback_view(request):
    error = request.GET.get("error") or request.GET.get("error_description")
    if error:
        return HttpResponseRedirect(zoho_mail.oauth_frontend_redirect(False, str(error)[:200]))
    code = request.GET.get("code") or ""
    state = request.GET.get("state") or ""
    if not code or not state:
        return HttpResponseRedirect(zoho_mail.oauth_frontend_redirect(False, "missing_code"))
    try:
        zoho_mail.exchange_code(code, state)
    except zoho_mail.ZohoMailError as exc:
        return HttpResponseRedirect(zoho_mail.oauth_frontend_redirect(False, str(exc)[:200]))
    return HttpResponseRedirect(zoho_mail.oauth_frontend_redirect(True))


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def zoho_status_view(request):
    denied = _forbid(request)
    if denied:
        return denied
    return Response(zoho_mail.status_payload())


@api_view(["POST"])
@permission_classes([IsPortalStaff])
def zoho_connect_view(request):
    denied = _forbid(request)
    if denied:
        return denied
    try:
        return Response(zoho_mail.build_authorization_url())
    except zoho_mail.ZohoMailError as exc:
        return Response({"error": str(exc)}, status=exc.status)


@api_view(["POST"])
@permission_classes([IsPortalStaff])
def zoho_disconnect_view(request):
    denied = _forbid(request)
    if denied:
        return denied
    zoho_mail.disconnect()
    return Response(zoho_mail.status_payload())


@api_view(["POST"])
@permission_classes([IsPortalStaff])
def zoho_refresh_folders_view(request):
    denied = _forbid(request)
    if denied:
        return denied
    try:
        zoho_mail.warm_account_and_folders(force=True)
        return Response(zoho_mail.status_payload())
    except zoho_mail.ZohoMailError as exc:
        return Response({"error": str(exc)}, status=exc.status)


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def zoho_inbox_view(request):
    return _list_mailbox(request, "inbox")


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def zoho_outbox_view(request):
    return _list_mailbox(request, "outbox")


def _list_mailbox(request, mailbox: str):
    denied = _forbid(request)
    if denied:
        return denied
    try:
        start = int(request.GET.get("start") or 1)
        limit = int(request.GET.get("limit") or 40)
    except (TypeError, ValueError):
        return Response({"error": "Invalid pagination."}, status=400)
    unread = str(request.GET.get("unreadOnly") or request.GET.get("unread_only") or "").lower() in (
        "1",
        "true",
        "yes",
    )
    search = str(request.GET.get("search") or request.GET.get("q") or "")
    try:
        return Response(
            zoho_mail.list_messages(
                mailbox=mailbox,
                start=start,
                limit=limit,
                unread_only=unread,
                search=search,
            )
        )
    except zoho_mail.ZohoMailError as exc:
        return Response({"error": str(exc)}, status=exc.status)


@api_view(["GET"])
@permission_classes([IsPortalStaff])
def zoho_message_detail_view(request, message_id: str):
    denied = _forbid(request)
    if denied:
        return denied
    folder_id = request.GET.get("folderId") or request.GET.get("folder_id")
    try:
        return Response(zoho_mail.get_message(message_id, folder_id))
    except zoho_mail.ZohoMailError as exc:
        return Response({"error": str(exc)}, status=exc.status)


@api_view(["POST"])
@permission_classes([IsPortalStaff])
def zoho_message_reply_view(request, message_id: str):
    denied = _forbid(request)
    if denied:
        return denied
    data = request.data or {}
    try:
        updated = zoho_mail.reply_message(
            message_id,
            message=str(data.get("message") or ""),
            subject=str(data.get("subject") or "") or None,
            to_address=str(data.get("toAddress") or data.get("to_address") or "") or None,
            folder_id=str(data.get("folderId") or data.get("folder_id") or "") or None,
        )
        return Response(updated)
    except zoho_mail.ZohoMailError as exc:
        return Response({"error": str(exc)}, status=exc.status)


@api_view(["POST"])
@permission_classes([IsPortalStaff])
def zoho_message_resolve_view(request, message_id: str):
    denied = _forbid(request)
    if denied:
        return denied
    data = request.data or {}
    folder_id = str(data.get("folderId") or data.get("folder_id") or "") or None
    try:
        return Response(zoho_mail.resolve_message(message_id, folder_id))
    except zoho_mail.ZohoMailError as exc:
        return Response({"error": str(exc)}, status=exc.status)
