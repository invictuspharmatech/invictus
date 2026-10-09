from __future__ import annotations

import re
from datetime import datetime
from html import escape

from django.conf import settings

_HTMLISH = re.compile(
    r"</?(p|div|br|h[1-6]|ul|ol|li|table|strong|em|a|span|img)\b",
    re.IGNORECASE,
)
_ALREADY_WRAPPED = re.compile(r"invictus-email-shell", re.IGNORECASE)
_FULL_DOCUMENT = re.compile(r"<!DOCTYPE html|<html[\s>]", re.IGNORECASE)


# Great Life wrapper layout (header plate, white card, branded footer), Invictus colors/logo.
DEFAULT_WRAPPER_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{APP_NAME}}</title>
  <style>
    @media only screen and (max-width: 480px) {
      .invictus-tagline { font-size: 11px !important; letter-spacing: 0.06em !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#140808;">
  <table class="invictus-email-shell" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#140808;margin:0;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(8,2,3,0.35);">
          <tr>
            <td style="background:linear-gradient(145deg,#3a0c0c 0%,#610c0d 42%,#8B1A1A 100%);padding:24px 12px 20px;text-align:center;">
              <img src="/images/invictus-logo.png" alt="{{APP_NAME}}" width="160" style="display:block;margin:0 auto;max-width:160px;height:auto;border:0;background:transparent;">
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" width="100%" style="margin:14px auto 0;width:100%;">
                <tr>
                  <td align="center" style="padding:12px 0 0;border-top:1px solid #c4a06a;">
                    <p class="invictus-tagline" style="margin:0;font-family:Georgia,Times,'Times New Roman',serif;font-size:15px;line-height:1.25;letter-spacing:0.18em;text-transform:uppercase;color:#e8c56a;white-space:nowrap;">
                      Precision performance and wellness essentials.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#3a1414;">
              {{EMAIL_BODY}}
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(145deg,#3a0c0c 0%,#610c0d 42%,#8B1A1A 100%);padding:22px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#e8c56a;">
                &copy; {{CURRENT_YEAR}} Invictus Pharma
              </p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;">
                <a href="/contact" style="color:#e8c56a;text-decoration:underline;">Contact</a>
                <span style="color:#c4a06a;"> &middot; </span>
                <a href="/faq" style="color:#e8c56a;text-decoration:underline;">FAQ</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def public_site_url() -> str:
    return (getattr(settings, "PUBLIC_SITE_URL", "") or "http://localhost:3000").rstrip("/")


def looks_like_html(text: str) -> bool:
    return bool(_HTMLISH.search(text or ""))


def plain_to_html(text: str) -> str:
    raw = text or ""
    if looks_like_html(raw):
        return raw
    stripped = raw.strip()
    if not stripped:
        return ""
    blocks = re.split(r"\n\s*\n", stripped)
    parts: list[str] = []
    for block in blocks:
        inner = escape(block).replace("\n", "<br>\n")
        parts.append(f'<p style="margin:0 0 14px;">{inner}</p>')
    return "".join(parts)


def _absolutize_urls(html: str, base: str) -> str:
    def repl(match: re.Match[str]) -> str:
        attr, quote, path = match.group(1), match.group(2), match.group(3)
        if path.startswith("//") or path.startswith("http://") or path.startswith("https://"):
            return match.group(0)
        return f"{attr}={quote}{base}/{path.lstrip('/')}{quote}"

    return re.sub(
        r"""(href|src)=(["'])/(?!/)([^"']*)\2""",
        repl,
        html,
        flags=re.IGNORECASE,
    )


def apply_wrapper_globals(html: str) -> str:
    base = public_site_url()
    app_name = getattr(settings, "SITE_NAME", None) or "Invictus Pharma"
    filled = (
        html.replace("{{CURRENT_YEAR}}", str(datetime.now().year))
        .replace("{{APP_NAME}}", app_name)
        .replace("{{APP_URL}}", base)
    )
    return _absolutize_urls(filled, base)


def wrap_email_body(inner_html: str, wrapper_html: str | None = None) -> str:
    inner = inner_html or ""
    if _ALREADY_WRAPPED.search(inner) or _FULL_DOCUMENT.search(inner):
        return apply_wrapper_globals(inner)
    wrapper = (wrapper_html or "").strip() or DEFAULT_WRAPPER_HTML
    if "{{EMAIL_BODY}}" in wrapper:
        wrapped = wrapper.replace("{{EMAIL_BODY}}", inner)
    else:
        wrapped = wrapper + inner
    return apply_wrapper_globals(wrapped)
