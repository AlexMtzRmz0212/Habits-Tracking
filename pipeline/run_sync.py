"""Load a Loop Habits backup into Postgres.

    python -m pipeline.run_sync                  # newest .db in data/raw
    python -m pipeline.run_sync --file path.db   # a specific backup
    python -m pipeline.run_sync --dry-run        # read and report, write nothing

Safe to re-run: every write is an upsert, and your public/private curation is
never touched.
"""

from __future__ import annotations

import argparse
import os
import sys
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--file", help="path to a Loop Habits .db backup")
    parser.add_argument("--dry-run", action="store_true", help="read and report, write nothing")
    args = parser.parse_args()

    from pipeline.ingest import loader

    path = Path(args.file) if args.file else loader.find_latest_backup()
    print(f"Backup: {path.name}")

    habits, repetitions = loader.load_backup(path)
    dates = [r.entry_date for r in repetitions]
    print(f"Read  : {len(habits)} habits, {len(repetitions)} repetitions")
    if dates:
        print(f"        {min(dates)} .. {max(dates)}")

    if args.dry_run:
        print("\nDry run -- nothing written.")
        return

    load_env()
    url = os.environ.get("DATABASE_URL_PRIVATE", "").strip()
    if not url:
        sys.exit(
            "DATABASE_URL_PRIVATE is not set.\n"
            "Copy .env.example to .env and paste your Neon connection string into it."
        )

    try:
        import psycopg
    except ImportError:
        sys.exit("psycopg is not installed. Run: pip install -r requirements.txt")

    from pipeline.db import writer

    print(f"Target: {safe_target(url)}")

    with psycopg.connect(url) as conn:
        run_id = writer.start_sync_run(conn, source_file_name=path.name)
        conn.commit()
        try:
            habit_ids = writer.upsert_habits(conn, habits)
            written = writer.upsert_repetitions(conn, repetitions, habit_ids)
            writer.finish_sync_run(conn, run_id, "success", rows_upserted=written)
            conn.commit()
        except Exception as exc:
            conn.rollback()
            # Record the failure on its own connection state, so the audit trail
            # survives whatever went wrong above.
            writer.finish_sync_run(conn, run_id, "failed", error_message=str(exc)[:2000])
            conn.commit()
            raise

        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM habits")
            n_habits = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM repetitions")
            n_reps = cur.fetchone()[0]
            cur.execute("SELECT count(*) FROM habits WHERE is_public")
            n_public = cur.fetchone()[0]

    print(f"\nWrote : {written} repetitions")
    print(f"In db : {n_habits} habits, {n_reps} repetitions")
    print(f"Public: {n_public} habits marked public (curate with scripts/tag_habits.py)")


if __name__ == "__main__":
    main()
