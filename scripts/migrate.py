"""Apply SQL migrations in db/migrations/ to the database, in order, once each.

Reads DATABASE_URL_PRIVATE from the environment (or a local .env). The value is
never printed — only the host is shown — so running this with output visible
cannot leak the password.

    python scripts/migrate.py            # apply anything not yet applied
    python scripts/migrate.py --status   # show what is/isn't applied
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = REPO_ROOT / "db" / "migrations"


def load_env() -> None:
    """Load .env if python-dotenv is available; real env vars still win."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(REPO_ROOT / ".env")


def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL_PRIVATE", "").strip()
    if not url:
        sys.exit(
            "DATABASE_URL_PRIVATE is not set.\n"
            "Copy .env.example to .env and paste your Neon connection string into it."
        )
    return url


def safe_target(url: str) -> str:
    """Describe the connection without revealing credentials."""
    try:
        parsed = urlparse(url)
        return f"{parsed.hostname}{parsed.path}"
    except Exception:
        return "(unparseable connection string)"


def discover_migrations() -> list[Path]:
    if not MIGRATIONS_DIR.is_dir():
        sys.exit(f"No migrations directory at {MIGRATIONS_DIR}")
    return sorted(MIGRATIONS_DIR.glob("*.sql"))


def applied_versions(conn) -> set[str]:
    """Versions already applied. Empty on a fresh database."""
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.schema_migrations')")
        if cur.fetchone()[0] is None:
            return set()
        cur.execute("SELECT version FROM schema_migrations")
        return {row[0] for row in cur.fetchall()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--status", action="store_true", help="show state, change nothing")
    args = parser.parse_args()

    load_env()
    url = get_database_url()

    try:
        import psycopg
    except ImportError:
        sys.exit("psycopg is not installed. Run: pip install -r requirements.txt")

    migrations = discover_migrations()
    if not migrations:
        sys.exit(f"No .sql files found in {MIGRATIONS_DIR}")

    print(f"Database: {safe_target(url)}")

    with psycopg.connect(url) as conn:
        done = applied_versions(conn)

        if args.status:
            print(f"\n{len(migrations)} migration(s) on disk:")
            for path in migrations:
                mark = "applied" if path.stem in done else "PENDING"
                print(f"  [{mark:>7}] {path.name}")
            return

        pending = [p for p in migrations if p.stem not in done]
        if not pending:
            print(f"Already up to date ({len(done)} applied).")
            return

        for path in pending:
            print(f"Applying {path.name} ...", end=" ", flush=True)
            sql = path.read_text(encoding="utf-8")
            # Each migration runs in its own transaction, so a failure leaves
            # the database on the last good migration rather than half-applied.
            try:
                with conn.transaction():
                    with conn.cursor() as cur:
                        cur.execute(sql)
                        cur.execute(
                            "INSERT INTO schema_migrations (version) VALUES (%s) "
                            "ON CONFLICT (version) DO NOTHING",
                            (path.stem,),
                        )
            except Exception as exc:
                print("FAILED")
                sys.exit(f"\n{path.name} failed, nothing from it was applied:\n{exc}")
            print("ok")

        print(f"\nDone. {len(pending)} migration(s) applied.")


if __name__ == "__main__":
    main()
