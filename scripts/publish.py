"""Decide which analyses are public.

This is the only place publishing happens. Habit data is never public; an
analysis is public only if you say so here.

    python scripts/publish.py list                    # everything, with status
    python scripts/publish.py show sleep-by-weekday   # read it before publishing
    python scripts/publish.py add sleep-by-weekday    # make it public
    python scripts/publish.py remove sleep-by-weekday # take it back down

Re-running the analytics job refreshes the numbers and prose but never changes
these decisions.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Habit names can appear in an analysis title, and they contain emoji.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def connect():
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
    return psycopg.connect(url)


def cmd_list(conn, args) -> None:
    rows = conn.execute(
        "SELECT slug, title, scope, kind, is_public, generated_at "
        "FROM insights ORDER BY is_public DESC, slug"
    ).fetchall()
    if not rows:
        print("No analyses yet. Run: python -m pipeline.run_analyze")
        return

    print(f"{'status':<9} {'slug':<26} {'kind':<11} title")
    print("-" * 82)
    for slug, title, _scope, kind, is_public, _gen in rows:
        print(f"{'PUBLIC' if is_public else 'private':<9} {slug:<26} {kind:<11} {title}")
    n_public = sum(1 for r in rows if r[4])
    print(f"\n{len(rows)} analysis/analyses, {n_public} public.")
    if not n_public:
        print("Nothing is public yet. Read one with: python scripts/publish.py show <slug>")


def cmd_show(conn, args) -> None:
    row = conn.execute(
        "SELECT slug, title, scope, kind, narrative, sql_example, metrics, is_public "
        "FROM insights WHERE slug = %s",
        (args.slug,),
    ).fetchone()
    if not row:
        sys.exit(f"No analysis with slug {args.slug!r}. See: publish.py list")

    slug, title, scope, kind, narrative, sql_example, metrics, is_public = row
    print(f"{title}")
    print(f"  slug   : {slug}")
    print(f"  status : {'PUBLIC' if is_public else 'private'}")
    print(f"  scope  : {scope} / {kind}")
    print(f"\n{narrative}\n")

    # Show the shape of the payload rather than dumping every data point.
    if isinstance(metrics, dict):
        for key, value in metrics.items():
            if isinstance(value, list):
                print(f"  {key}: {len(value)} point(s)")
                if value:
                    print(f"      e.g. {json.dumps(value[0])}")
            else:
                print(f"  {key}: {json.dumps(value)}")

    if sql_example and args.sql:
        print(f"\n--- SQL ---\n{sql_example}")
    elif sql_example:
        print("\n(pass --sql to see the query behind it)")


def _set_public(conn, slug: str, public: bool) -> None:
    row = conn.execute(
        "UPDATE insights SET is_public = %s WHERE slug = %s RETURNING title",
        (public, slug),
    ).fetchone()
    if not row:
        sys.exit(f"No analysis with slug {slug!r}. See: publish.py list")
    conn.commit()
    print(f"{'Published' if public else 'Unpublished'}: {row[0]}")
    if public:
        print("\nThis will appear on the public portfolio page. The habit data "
              "behind it stays private -- only this analysis is served.")


def cmd_add(conn, args) -> None:
    _set_public(conn, args.slug, True)


def cmd_remove(conn, args) -> None:
    _set_public(conn, args.slug, False)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command")

    p_list = sub.add_parser("list", help="show every analysis and its status")
    p_list.set_defaults(func=cmd_list)

    p_show = sub.add_parser("show", help="read one analysis in full")
    p_show.add_argument("slug")
    p_show.add_argument("--sql", action="store_true", help="also print the query")
    p_show.set_defaults(func=cmd_show)

    p_add = sub.add_parser("add", help="make an analysis public")
    p_add.add_argument("slug")
    p_add.set_defaults(func=cmd_add)

    p_rm = sub.add_parser("remove", help="take an analysis back down")
    p_rm.add_argument("slug")
    p_rm.set_defaults(func=cmd_remove)

    args = parser.parse_args()
    if not args.command:
        args = parser.parse_args(["list"])

    with connect() as conn:
        args.func(conn, args)


if __name__ == "__main__":
    main()
