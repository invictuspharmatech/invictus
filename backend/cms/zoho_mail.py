"""Zoho Mail OAuth + REST helpers (AU defaults, same surface as PurePharma/GreatLife)."""

from __future__ import annotations

import json
import logging
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from html import escape
from typing import Any

from django.conf import settings
from django.core.cache import cache

from cms.models import SiteSetting

logger = logging.getLogger(__name__)

GROUP = "zoho_mail"
KEY_REFRESH = "zoho_mail.refresh_token"
KEY_ACCOUNT = "zoho_mail.account_id"
KEY_INBOX = "zoho_mail.inbox_folder_id"
KEY_SENT = "zoho_mail.sent_folder_id"
KEY_MAILBOX = "zoho_mail.mailbox_address"
CACHE_ACCESS = "zoho_mail.access_token"


class ZohoMailError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _cfg() -> dict[str, str]:
    public = (getattr(settings, "PUBLIC_SITE_URL", "") or "http://localhost:3000").rstrip("/")
    # Live nginx routes /api/* to Django. Locally Next can proxy the same path.
    default_redirect = f"{public}/api/zoho-mail/oauth/callback/"
    redirect = (getattr(settings, "ZOHO_MAIL_REDIRECT_URI", "") or "").strip() or default_redirect
    return {
        "client_id": (getattr(settings, "ZOHO_MAIL_CLIENT_ID", "") or "").strip(),
        "client_secret": (getattr(settings, "ZOHO_MAIL_CLIENT_SECRET", "") or "").strip(),
        "accounts_url": (
            getattr(settings, "ZOHO_MAIL_ACCOUNTS_URL", "") or "https://accounts.zoho.com.au"
        ).rstrip("/"),
        "api_url": (getattr(settings, "ZOHO_MAIL_API_URL", "") or "https://mail.zoho.com.au").rstrip(
            "/"
        ),
        "redirect_uri": redirect,
        "from_address": (getattr(settings, "ZOHO_MAIL_FROM_ADDRESS", "") or "").strip(),
        "resolved_folder_id": (
            getattr(settings, "ZOHO_MAIL_RESOLVED_FOLDER_ID", "") or ""
        ).strip(),
        "scopes": (
            getattr(settings, "ZOHO_MAIL_SCOPES", "")
            or "ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.READ,"
            "ZohoMail.messages.CREATE,ZohoMail.messages.UPDATE"
        ),
        "frontend_url": public,
    }


def _get_setting(key: str, default: str = "") -> str:
    row = SiteSetting.objects.filter(pk=key).first()
    if row and row.value:
        return row.value.strip()
    if key == KEY_REFRESH:
        return (getattr(settings, "ZOHO_MAIL_REFRESH_TOKEN", "") or "").strip()
    return default


def _set_setting(key: str, value: str, label: str) -> None:
    SiteSetting.objects.update_or_create(
        key=key,
        defaults={"value": value or "", "label": label, "group": GROUP},
    )


def _clear_setting(key: str) -> None:
    SiteSetting.objects.filter(pk=key).delete()


def _http(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    form: dict[str, str] | None = None,
    json_body: dict | None = None,
    timeout: int = 45,
) -> tuple[int, Any]:
    data = None
    req_headers = {"Accept": "application/json", **(headers or {})}
    if form is not None:
        data = urllib.parse.urlencode(form).encode()
        req_headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif json_body is not None:
        data = json.dumps(json_body).encode()
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=req_headers)
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            raw = resp.read()
            if not raw:
                return resp.status, {}
            try:
                return resp.status, json.loads(raw.decode())
            except json.JSONDecodeError:
                return resp.status, {"raw": raw.decode(errors="replace")}
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            parsed = json.loads(raw.decode() or "{}")
        except Exception:
            parsed = {"message": raw.decode(errors="replace")}
        return exc.code, parsed
    except urllib.error.URLError as exc:
        raise ZohoMailError(f"Could not reach Zoho: {exc.reason}", status=502) from exc


def is_configured() -> bool:
    cfg = _cfg()
    return bool(cfg["client_id"] and cfg["client_secret"])


def is_connected() -> bool:
    return bool(_get_setting(KEY_REFRESH))


def status_payload() -> dict[str, Any]:
    cfg = _cfg()
    return {
        "configured": is_configured(),
        "connected": is_connected(),
        "redirectUri": cfg["redirect_uri"],
        "accountsUrl": cfg["accounts_url"],
        "apiUrl": cfg["api_url"],
        "fromAddress": cfg["from_address"] or _get_setting(KEY_MAILBOX),
        "resolvedFolderId": cfg["resolved_folder_id"],
        "mailboxAddress": _get_setting(KEY_MAILBOX),
    }


def build_authorization_url() -> dict[str, str]:
    cfg = _cfg()
    if not is_configured():
        raise ZohoMailError(
            "Zoho Mail is not configured. Set ZOHO_MAIL_CLIENT_ID and ZOHO_MAIL_CLIENT_SECRET.",
            status=422,
        )
    state = uuid.uuid4().hex
    cache.set(f"zoho_mail.oauth_state.{state}", "1", timeout=60 * 15)
    query = urllib.parse.urlencode(
        {
            "scope": cfg["scopes"],
            "client_id": cfg["client_id"],
            "response_type": "code",
            "access_type": "offline",
            "prompt": "consent",
            "redirect_uri": cfg["redirect_uri"],
            "state": state,
        }
    )
    return {
        "authorizationUrl": f"{cfg['accounts_url']}/oauth/v2/auth?{query}",
        "redirectUri": cfg["redirect_uri"],
    }


def exchange_code(code: str, state: str) -> None:
    cfg = _cfg()
    if not cache.get(f"zoho_mail.oauth_state.{state}"):
        raise ZohoMailError("Invalid or expired OAuth state.", status=400)
    cache.delete(f"zoho_mail.oauth_state.{state}")
    status, payload = _http(
        "POST",
        f"{cfg['accounts_url']}/oauth/v2/token",
        form={
            "grant_type": "authorization_code",
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "redirect_uri": cfg["redirect_uri"],
            "code": code,
        },
    )
    if status >= 400 or not payload.get("refresh_token"):
        msg = payload.get("error") or payload.get("message") or "OAuth token exchange failed."
        raise ZohoMailError(str(msg), status=400)
    _set_setting(KEY_REFRESH, str(payload["refresh_token"]), "Zoho Mail refresh token")
    cache.delete(CACHE_ACCESS)
    if payload.get("access_token"):
        expires = max(60, int(payload.get("expires_in") or 3600) - 60)
        cache.set(CACHE_ACCESS, str(payload["access_token"]), timeout=expires)
    warm_account_and_folders(force=True)


def disconnect() -> None:
    for key in (KEY_REFRESH, KEY_ACCOUNT, KEY_INBOX, KEY_SENT, KEY_MAILBOX):
        _clear_setting(key)
    cache.delete(CACHE_ACCESS)


def access_token() -> str:
    cached = cache.get(CACHE_ACCESS)
    if cached:
        return str(cached)
    cfg = _cfg()
    refresh = _get_setting(KEY_REFRESH)
    if not refresh:
        raise ZohoMailError("Zoho Mail is not connected.", status=409)
    status, payload = _http(
        "POST",
        f"{cfg['accounts_url']}/oauth/v2/token",
        form={
            "grant_type": "refresh_token",
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "refresh_token": refresh,
        },
    )
    token = payload.get("access_token")
    if status >= 400 or not token:
        msg = payload.get("error") or payload.get("message") or "Could not refresh Zoho access token."
        raise ZohoMailError(str(msg), status=409)
    expires = max(60, int(payload.get("expires_in") or 3600) - 60)
    cache.set(CACHE_ACCESS, str(token), timeout=expires)
    return str(token)


def _api(method: str, path: str, *, json_body: dict | None = None, query: dict | None = None) -> Any:
    cfg = _cfg()
    url = f"{cfg['api_url']}{path}"
    if query:
        url = f"{url}?{urllib.parse.urlencode({k: v for k, v in query.items() if v is not None})}"
    status, payload = _http(
        method,
        url,
        headers={"Authorization": f"Zoho-oauthtoken {access_token()}"},
        json_body=json_body,
    )
    if status >= 400:
        msg = (
            payload.get("data", {}).get("moreInfo")
            if isinstance(payload.get("data"), dict)
            else None
        ) or payload.get("message") or payload.get("error") or f"Zoho API error ({status})"
        raise ZohoMailError(str(msg), status=502 if status >= 500 else 422)
    return payload


def warm_account_and_folders(force: bool = False) -> None:
    account_id = _get_setting(KEY_ACCOUNT)
    inbox = _get_setting(KEY_INBOX)
    sent = _get_setting(KEY_SENT)
    if not force and account_id and inbox and sent:
        return
    payload = _api("GET", "/api/accounts")
    rows = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(rows, list) or not rows:
        raise ZohoMailError("No Zoho Mail accounts found for this connection.", status=422)
    account = rows[0]
    account_id = str(account.get("accountId") or account.get("id") or "")
    if not account_id:
        raise ZohoMailError("Zoho account id missing.", status=422)
    _set_setting(KEY_ACCOUNT, account_id, "Zoho Mail account id")

    mailbox = (
        account.get("primaryEmailAddress")
        or account.get("mailboxAddress")
        or account.get("incomingUserName")
        or ""
    )
    details = account.get("sendMailDetails") or []
    if not mailbox and isinstance(details, list) and details:
        mailbox = details[0].get("fromAddress") or ""
    if mailbox:
        _set_setting(KEY_MAILBOX, str(mailbox), "Zoho Mail mailbox address")

    folders_payload = _api("GET", f"/api/accounts/{account_id}/folders")
    folders = folders_payload.get("data") if isinstance(folders_payload, dict) else None
    if not isinstance(folders, list):
        folders = []
    inbox_id = ""
    sent_id = ""
    for folder in folders:
        ftype = str(folder.get("folderType") or "")
        fid = str(folder.get("folderId") or folder.get("id") or "")
        if ftype == "Inbox" and not inbox_id:
            inbox_id = fid
        if ftype == "Sent" and not sent_id:
            sent_id = fid
    if inbox_id:
        _set_setting(KEY_INBOX, inbox_id, "Zoho Mail inbox folder id")
    if sent_id:
        _set_setting(KEY_SENT, sent_id, "Zoho Mail sent folder id")
    if not inbox_id or not sent_id:
        raise ZohoMailError("Could not resolve Zoho Inbox/Sent folders.", status=422)


def account_id() -> str:
    warm_account_and_folders()
    value = _get_setting(KEY_ACCOUNT)
    if not value:
        raise ZohoMailError("Zoho account not resolved.", status=409)
    return value


def inbox_folder_id() -> str:
    warm_account_and_folders()
    value = _get_setting(KEY_INBOX)
    if not value:
        raise ZohoMailError("Zoho inbox folder not resolved.", status=409)
    return value


def sent_folder_id() -> str:
    warm_account_and_folders()
    value = _get_setting(KEY_SENT)
    if not value:
        raise ZohoMailError("Zoho sent folder not resolved.", status=409)
    return value


def mailbox_address() -> str:
    cfg = _cfg()
    return cfg["from_address"] or _get_setting(KEY_MAILBOX)


def _parse_received_at(raw: Any) -> str | None:
    if raw is None or raw == "":
        return None
    try:
        value = int(raw)
        if value > 10_000_000_000:
            value = value / 1000
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OSError):
        return str(raw)


def _map_list_row(row: dict) -> dict[str, Any]:
    return {
        "id": str(row.get("messageId") or row.get("id") or ""),
        "folderId": str(row.get("folderId") or ""),
        "threadId": str(row.get("threadId") or ""),
        "subject": str(row.get("subject") or "(no subject)"),
        "fromAddress": str(row.get("fromAddress") or row.get("sender") or ""),
        "fromName": str(row.get("sender") or row.get("fromAddress") or ""),
        "toAddress": str(row.get("toAddress") or ""),
        "summary": str(row.get("summary") or row.get("snippet") or ""),
        "hasAttachment": bool(row.get("hasAttachment")),
        "isUnread": str(row.get("status") or "0") == "0",
        "receivedAt": _parse_received_at(row.get("receivedTime") or row.get("sentDateInGMT")),
    }


def list_messages(
    *,
    mailbox: str = "inbox",
    start: int = 1,
    limit: int = 40,
    unread_only: bool = False,
    search: str = "",
) -> dict[str, Any]:
    if not is_connected():
        raise ZohoMailError("Zoho Mail is not connected.", status=409)
    folder_id = inbox_folder_id() if mailbox == "inbox" else sent_folder_id()
    aid = account_id()
    start = max(1, int(start))
    limit = max(1, min(100, int(limit)))
    query: dict[str, Any] = {
        "folderId": folder_id,
        "start": start,
        "limit": limit,
        "includeto": "true",
        "sortBy": "date",
        "sortorder": "false",
    }
    if unread_only and mailbox == "inbox":
        query["status"] = "unread"
    payload = _api("GET", f"/api/accounts/{aid}/messages/view", query=query)
    data = payload.get("data") if isinstance(payload, dict) else None
    rows = data if isinstance(data, list) else []
    mapped = [_map_list_row(row) for row in rows if isinstance(row, dict)]
    needle = (search or "").strip().lower()
    if needle:
        mapped = [
            row
            for row in mapped
            if needle in (row["subject"] or "").lower()
            or needle in (row["fromAddress"] or "").lower()
            or needle in (row["toAddress"] or "").lower()
            or needle in (row["summary"] or "").lower()
            or needle in (row["fromName"] or "").lower()
        ]
    return {
        "data": mapped,
        "total": len(mapped),
        "folderId": folder_id,
        "accountId": aid,
    }


def _extract_email(value: str) -> str:
    match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", value or "")
    return match.group(0) if match else (value or "").strip()


def get_message(message_id: str, folder_id: str | None = None) -> dict[str, Any]:
    if not is_connected():
        raise ZohoMailError("Zoho Mail is not connected.", status=409)
    aid = account_id()
    folder = (folder_id or "").strip() or inbox_folder_id()
    details = _api(
        "GET",
        f"/api/accounts/{aid}/folders/{folder}/messages/{message_id}/details",
    )
    content = _api(
        "GET",
        f"/api/accounts/{aid}/folders/{folder}/messages/{message_id}/content",
    )
    header = _api(
        "GET",
        f"/api/accounts/{aid}/folders/{folder}/messages/{message_id}/header",
        query={"raw": "false"},
    )
    detail = details.get("data") if isinstance(details, dict) else details
    if not isinstance(detail, dict):
        detail = {}
    body = content.get("data") if isinstance(content, dict) else content
    html = ""
    if isinstance(body, dict):
        html = str(body.get("content") or body.get("message") or "")
    elif isinstance(body, str):
        html = body
    header_data = header.get("data") if isinstance(header, dict) else {}
    reply_to = ""
    if isinstance(header_data, dict):
        reply_to = str(header_data.get("Reply-To") or header_data.get("reply-to") or "")
    from_address = str(detail.get("fromAddress") or detail.get("sender") or "")
    summary = str(detail.get("summary") or "")
    reply_recipient = _extract_email(reply_to) or _extract_email(from_address)
    own = (mailbox_address() or "").lower()
    if reply_recipient.lower() in ("", own) or "noreply" in reply_recipient.lower():
        scraped = re.search(
            r"(?:Email|E-mail|From)\s*:\s*([\w.+-]+@[\w.-]+\.\w+)",
            summary + " " + html,
            re.I,
        )
        if scraped:
            reply_recipient = scraped.group(1)
    return {
        "id": str(message_id),
        "folderId": folder,
        "accountId": aid,
        "subject": str(detail.get("subject") or "(no subject)"),
        "fromAddress": from_address,
        "fromName": str(detail.get("sender") or from_address),
        "toAddress": str(detail.get("toAddress") or ""),
        "replyToAddress": _extract_email(reply_to),
        "replyRecipient": reply_recipient,
        "summary": summary,
        "contentHtml": html,
        "hasAttachment": bool(detail.get("hasAttachment")),
        "isUnread": str(detail.get("status") or "0") == "0",
        "receivedAt": _parse_received_at(detail.get("receivedTime") or detail.get("sentDateInGMT")),
    }


def reply_message(
    message_id: str,
    *,
    message: str,
    subject: str | None = None,
    to_address: str | None = None,
    folder_id: str | None = None,
) -> dict[str, Any]:
    body = (message or "").strip()
    if not body:
        raise ZohoMailError("Reply message is required.", status=422)
    if len(body) > 20000:
        raise ZohoMailError("Reply is too long.", status=422)
    original = get_message(message_id, folder_id)
    to_addr = _extract_email(to_address or "") or original.get("replyRecipient") or ""
    own = (mailbox_address() or "").lower()
    if not to_addr or to_addr.lower() == own or "noreply" in to_addr.lower():
        raise ZohoMailError("Could not determine a reply recipient.", status=422)
    subj = (subject or "").strip() or f"Re: {original.get('subject') or ''}".strip()
    html = "<p>" + escape(body).replace("\n", "<br>") + "</p>"
    aid = account_id()
    _api(
        "POST",
        f"/api/accounts/{aid}/messages/{message_id}",
        json_body={
            "fromAddress": mailbox_address(),
            "toAddress": to_addr,
            "subject": subj[:255],
            "content": html,
            "mailFormat": "html",
            "action": "reply",
        },
    )
    return get_message(message_id, folder_id or original.get("folderId"))


def resolve_message(message_id: str, folder_id: str | None = None) -> dict[str, Any]:
    cfg = _cfg()
    dest = cfg["resolved_folder_id"]
    if not dest:
        raise ZohoMailError(
            "Set ZOHO_MAIL_RESOLVED_FOLDER_ID to move messages into your Resolved folder.",
            status=422,
        )
    aid = account_id()
    source = (folder_id or "").strip() or inbox_folder_id()
    try:
        mid = int(message_id)
    except ValueError:
        mid = message_id
    try:
        dest_id: Any = int(dest)
    except ValueError:
        dest_id = dest
    try:
        source_id: Any = int(source)
    except ValueError:
        source_id = source
    payload = {
        "mode": "moveMessage",
        "destfolderId": dest_id,
        "messageId": [mid],
        "isFolderSpecific": True,
        "folderId": source_id,
    }
    _api("PUT", f"/api/accounts/{aid}/updatemessage", json_body=payload)
    return {
        "moved": True,
        "messageIds": [str(message_id)],
        "destFolderId": str(dest),
        "sourceFolderId": str(source),
    }


def oauth_frontend_redirect(success: bool, error: str | None = None) -> str:
    cfg = _cfg()
    base = f"{cfg['frontend_url']}/admin/email/zoho"
    if success:
        return f"{base}?zoho_connected=1"
    q = urllib.parse.urlencode({"zoho_error": error or "oauth_failed"})
    return f"{base}?{q}"
