from __future__ import annotations

from datetime import datetime
from pathlib import PurePosixPath

from django.core.files.storage import default_storage
from django.utils import timezone

from catalog.image_import import IMAGE_EXTENSIONS, sanitize_upload_filename

ALLOWED_FOLDERS = ("products", "site")


def _iso_mtime(relative: str) -> str | None:
    try:
        modified = default_storage.get_modified_time(relative)
    except Exception:
        return None
    if modified is None:
        return None
    if timezone.is_naive(modified):
        modified = timezone.make_aware(modified, timezone.get_current_timezone())
    if isinstance(modified, datetime):
        return modified.isoformat()
    return None


def list_media_items(folder: str | None = None) -> list[dict]:
    """
    List images under MEDIA_ROOT/{products,site}/.
    Returns public URL paths nginx serves at /media/...
    Includes uploadedAt (file mtime) for admin sorting/filters.
    """
    folders = (
        [folder]
        if folder in ALLOWED_FOLDERS
        else list(ALLOWED_FOLDERS)
    )
    items: list[dict] = []
    for folder_name in folders:
        try:
            _dirs, files = default_storage.listdir(folder_name)
        except Exception:
            continue
        for name in files:
            ext = PurePosixPath(name).suffix.lower()
            if name.startswith(".") or ext not in IMAGE_EXTENSIONS:
                continue
            relative = f"{folder_name}/{name}"
            items.append(
                {
                    "path": f"/media/{relative.lstrip('/')}",
                    "name": name,
                    "folder": folder_name,
                    "uploadedAt": _iso_mtime(relative),
                }
            )
    # Newest first by default; name is a secondary key for stable ordering.
    items.sort(
        key=lambda row: (
            row.get("uploadedAt") or "",
            (row.get("name") or "").lower(),
        ),
        reverse=True,
    )
    return items


def save_uploaded_media(uploaded_file, folder: str = "products") -> str:
    """
    Persist to MEDIA_ROOT/{folder}/ (live: ./data/media via Docker).
    Returns a public URL path served at /media/...
    """
    if folder not in ALLOWED_FOLDERS:
        raise ValueError(f"Unsupported media folder: {folder}")
    name = sanitize_upload_filename(getattr(uploaded_file, "name", "") or "image.png")
    relative = f"{folder}/{name}"
    if default_storage.exists(relative):
        stem = PurePosixPath(name).stem
        ext = PurePosixPath(name).suffix
        n = 2
        while default_storage.exists(f"{folder}/{stem}-{n}{ext}"):
            n += 1
        relative = f"{folder}/{stem}-{n}{ext}"
    saved = default_storage.save(relative, uploaded_file)
    return f"/media/{saved.lstrip('/')}"
