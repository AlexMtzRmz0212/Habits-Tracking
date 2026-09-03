"""Load a Loop Habits backup into Postgres.

    python -m pipeline.run_sync                  # newest .db in data/raw
    python -m pipeline.run_sync --file path.db   # a specific backup
    python -m pipeline.run_sync --from-drive     # newest backup in Google Drive
    python -m pipeline.run_sync --dry-run        # read and report, write nothing

Safe to re-run: every write is an upsert, and nothing you have published gets
unpublished. With --from-drive the job exits early when Drive holds the same
file the last successful run already processed.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent


def load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(REPO_ROOT / ".env")


def safe_target(url: str) -> str:
    """Host and database only -- never the password."""
    try:
        parsed = urlparse(url)
        return f"{parsed.hostname}{parsed.path}"
    except Exception:
        return "(unparseable connection string)"


def connect(url: str):
    try:
        import psycopg
    except ImportError:
        sys.exit("psycopg is not installed. Run: pip install -r requirements.txt")
    return psycopg.connect(url)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", help="path to a Loop Habits .db backup")
    parser.add_argument("--from-drive", action="store_true",
                        help="fetch the newest backup from Google Drive")
    parser.add_argument("--dry-run", action="store_true",
                        help="read and report, write nothing")
    parser.add_argument("--force", action="store_true",
                        help="with --from-drive, re-import even if unchanged")
    args = parser.parse_args()

    load_env()
    from pipeline.db import writer
    from pipeline.ingest import loader

    url = os.environ.get("DATABASE_URL_PRIVATE", "").strip()
    if not url and not args.dry_run:
        sys.exit("DATABASE_URL_PRIVATE is not set. See .env.example.")

    source = None      # DriveFile, when pulling from Drive
    tempdir = None

    if args.from_drive:
        from pipeline.ingest import drive

        source = drive.find_latest_backup()
        if source is None:
            print("No .db backup found in the Drive folder. Nothing to do.")
            return
        print(f"Drive : {source.name} (modified {source.modified_time:%Y-%m-%d %H:%M} UTC)")

        # Ask the database what it last processed before spending a download.
        if not args.force and not args.dry_run:
            with connect(url) as conn:
                last = writer.last_successful_sync(conn)
                if drive.is_unchanged(source, last):
                    run_id = writer.start_sync_run(
                        conn, source_file_name=source.name,
                        source_modified_time=source.modified_time,
                        source_md5=source.md5)
                    writer.finish_sync_run(conn, run_id, "skipped_no_change", rows_upserted=0)
                    conn.commit()
                    print("Unchanged since the last successful sync. Nothing to do.")
                    return

        tempdir = tempfile.TemporaryDirectory()
        path = drive.download(source, tempdir.name)
        print(f"Downloaded {path.stat().st_size:,} bytes")
    else:
        path = Path(args.file) if args.file else loader.find_latest_backup()

    print(f"Backup: {path.name}")

    try:
        habits, repetitions = loader.load_backup(path)
        dates = [r.entry_date for r in repetitions]
        print(f"Read  : {len(habits)} habits, {len(repetitions)} repetitions")
        if dates:
            print(f"        {min(dates)} .. {max(dates)}")

        if args.dry_run:
            print("\nDry run -- nothing written.")
            return

        print(f"Target: {safe_target(url)}")

        with connect(url) as conn:
            run_id = writer.start_sync_run(
                conn,
                source_file_name=source.name if source else path.name,
                source_modified_time=source.modified_time if source else None,
                source_md5=source.md5 if source else None,
            )
            conn.commit()
            try:
                habit_ids = writer.upsert_habits(conn, habits)
                written = writer.upsert_repetitions(conn, repetitions, habit_ids)
                writer.finish_sync_run(conn, run_id, "success", rows_upserted=written)
                conn.commit()
            except Exception as exc:
                conn.rollback()
                writer.finish_sync_run(conn, run_id, "failed", error_message=str(exc)[:2000])
                conn.commit()
                raise

            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM habits")
                n_habits = cur.fetchone()[0]
                cur.execute("SELECT count(*) FROM repetitions")
                n_reps = cur.fetchone()[0]

        print(f"\nWrote : {written} repetitions")
        print(f"In db : {n_habits} habits, {n_reps} repetitions")
    finally:
        # The downloaded backup is real habit data; do not leave it on the
        # runner's disk (or yours) a moment longer than needed.
        if tempdir is not None:
            tempdir.cleanup()


if __name__ == "__main__":
    main()
