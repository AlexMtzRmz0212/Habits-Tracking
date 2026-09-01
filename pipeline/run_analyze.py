"""Recompute derived metrics and analyses.

    python -m pipeline.run_analyze

Safe to re-run: derived metrics are upserted by date, and analyses are
upserted by slug. Nothing you have published gets unpublished.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent


def main() -> None:
    try:
        from dotenv import load_dotenv
        load_dotenv(REPO_ROOT / ".env")
    except ImportError:
        pass

    url = os.environ.get("DATABASE_URL_PRIVATE", "").strip()
    if not url:
        sys.exit("DATABASE_URL_PRIVATE is not set. See .env.example.")

    try:
        import psycopg
    except ImportError:
        sys.exit("psycopg is not installed. Run: pip install -r requirements.txt")

    from pipeline.analytics import derive, stats

    print(f"Database: {urlparse(url).hostname}")

    with psycopg.connect(url) as conn:
        print("\nDerived metrics:")
        derive.run_all(conn)

        print("\nAnalyses:")
        n = stats.run_all(conn)
        conn.commit()

        total, public = conn.execute(
            "SELECT count(*), count(*) FILTER (WHERE is_public) FROM insights"
        ).fetchone()

    print(f"\n{n} analysis/analyses computed.")
    print(f"{total} stored, {public} published.")
    print("\nPublish one with:  python scripts/publish.py <slug>")


if __name__ == "__main__":
    main()
