"""Minimal HS256 JWT helpers (stdlib only).

Avoids PyJWT/cryptography so local Windows Application Control policies
that block cryptography's Rust DLL do not break the API.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any


class TokenError(Exception):
    pass


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(raw: str) -> bytes:
    padding = "=" * (-len(raw) % 4)
    return base64.urlsafe_b64decode(raw + padding)


def encode(payload: dict[str, Any], secret: str, *, algorithm: str = "HS256") -> str:
    if algorithm != "HS256":
        raise TokenError(f"Unsupported algorithm: {algorithm}")
    header = {"alg": "HS256", "typ": "JWT"}
    segments = [
        _b64url_encode(json.dumps(header, separators=(",", ":"), sort_keys=True).encode()),
        _b64url_encode(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()),
    ]
    signing_input = ".".join(segments).encode("ascii")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    segments.append(_b64url_encode(signature))
    return ".".join(segments)


def decode(token: str, secret: str, *, algorithms: list[str] | None = None) -> dict[str, Any]:
    allowed = algorithms or ["HS256"]
    if "HS256" not in allowed:
        raise TokenError("HS256 not allowed.")
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
    except ValueError as exc:
        raise TokenError("Invalid token format.") from exc
    header = json.loads(_b64url_decode(header_b64))
    if header.get("alg") != "HS256":
        raise TokenError("Unexpected algorithm.")
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    actual = _b64url_decode(signature_b64)
    if not hmac.compare_digest(expected, actual):
        raise TokenError("Invalid signature.")
    payload = json.loads(_b64url_decode(payload_b64))
    exp = payload.get("exp")
    if exp is not None and int(exp) < int(time.time()):
        raise TokenError("Token expired.")
    return payload
