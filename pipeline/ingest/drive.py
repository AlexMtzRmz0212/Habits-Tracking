"""Fetch the newest Loop Habits backup from Google Drive.

Auth is a service account with read-only Drive scope, and the backup folder is
shared to that account's email as Viewer. This avoids the OAuth consent flow
entirely -- there is no human to consent, and a single-user script does not
need one. The service account can see exactly what you shared with it and
nothing else in your Drive.

Before downloading anything, it compares the file's metadata against the last
successful sync. Loop backs up on its own schedule and this job runs daily, so
most runs have nothing new to do; checking ~200 bytes of metadata beats pulling
a megabyte and reprocessing 26,000 rows to discover that.
"""

from __future__ import annotations

import base64
import binascii
import io
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


@dataclass(frozen=True)
class DriveFile:
    file_id: str
    name: str
    modified_time: datetime
    md5: str | None
    size: int | None


def _credentials():
    """Service-account credentials from GOOGLE_SERVICE_ACCOUNT_JSON.

    Accepts either raw JSON or base64-encoded JSON, because pasting raw JSON
    into a CI secret box is easy to get wrong (newlines in the private key).
    """
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        raise RuntimeError(
            "GOOGLE_SERVICE_ACCOUNT_JSON is not set. See docs/drive-sync.md."
        )

    if not raw.lstrip().startswith("{"):
        try:
            raw = base64.b64decode(raw).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError) as exc:
            raise RuntimeError(
                "GOOGLE_SERVICE_ACCOUNT_JSON is neither JSON nor valid base64."
            ) from exc

    try:
        info = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.") from exc

    from google.oauth2 import service_account

    return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)


def _service():
    from googleapiclient.discovery import build

    return build("drive", "v3", credentials=_credentials(), cache_discovery=False)


def find_latest_backup(folder_id: str | None = None) -> DriveFile | None:
    """Newest .db in the shared folder, or None if the folder has none."""
    folder_id = folder_id or os.environ.get("GOOGLE_DRIVE_FOLDER_ID", "").strip()
    if not folder_id:
        raise RuntimeError("GOOGLE_DRIVE_FOLDER_ID is not set.")

    service = _service()
    response = (
        service.files()
        .list(
            q=f"'{folder_id}' in parents and trashed = false",
            orderBy="modifiedTime desc",
            pageSize=25,
            fields="files(id, name, modifiedTime, md5Checksum, size, mimeType)",
            # Required for files that live in a shared drive rather than My Drive.
            supportsAllDrives=True,
            includeItemsFromAllDrives=True,
        )
        .execute()
    )

    for item in response.get("files", []):
        if not item["name"].lower().endswith(".db"):
            continue
        return DriveFile(
            file_id=item["id"],
            name=item["name"],
            modified_time=datetime.fromisoformat(
                item["modifiedTime"].replace("Z", "+00:00")
            ),
            md5=item.get("md5Checksum"),
            size=int(item["size"]) if item.get("size") else None,
        )
    return None


def is_unchanged(candidate: DriveFile, last_sync: dict | None) -> bool:
    """Whether this file is the one the last successful sync already processed.

    Prefers the checksum. Falls back to name plus modified time when Drive does
    not supply one -- a weaker check, so it is only used when it has to be.
    """
    if not last_sync:
        return False

    if candidate.md5 and last_sync.get("source_md5"):
        return candidate.md5 == last_sync["source_md5"]

    previous_time = last_sync.get("source_modified_time")
    if previous_time and last_sync.get("source_file_name") == candidate.name:
        if previous_time.tzinfo is None:
            previous_time = previous_time.replace(tzinfo=timezone.utc)
        return previous_time >= candidate.modified_time

    return False


def download(file: DriveFile, dest_dir: Path | str) -> Path:
    """Download to dest_dir, returning the local path."""
    from googleapiclient.http import MediaIoBaseDownload

    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / file.name

    service = _service()
    request = service.files().get_media(fileId=file.file_id, supportsAllDrives=True)

    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _status, done = downloader.next_chunk()

    dest.write_bytes(buffer.getvalue())
    return dest
