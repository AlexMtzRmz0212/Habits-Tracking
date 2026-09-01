"""Create the read-only public database role and prove it is actually locked down.

    python scripts/setup_public_role.py              # generate a password (recommended)
    python scripts/setup_public_role.py --prompt     # type your own instead

What it does:
  1. Creates (or re-passwords) the habits_public_ro role.
  2. Applies db/roles.sql -- the public view and its grants.
  3. Writes DATABASE_URL_PUBLIC into your .env.
  4. Connects AS that role and verifies it can read published analyses and
     cannot read habits, repetitions, or the insights base table.

Step 4 is the point. A grant you believe you made is worth nothing; a grant
you have watched fail to be exceeded is worth something. The password is never
printed, and never leaves your machine.
"""

from __future__ import annotations

import argparse
import secrets
import sys
from pathlib import Path
from urllib.parse import quote, urlsplit, urlunsplit

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = REPO_ROOT / ".env"
ROLES_SQL = REPO_ROOT / "db" / "roles.sql"
ROLE_NAME = "habits_public_ro"


def load_private_url() -> str:
    try:
        from dotenv import load_dotenv
        load_dotenv(ENV_PATH)
    except ImportError:
        pass
    import os
    url = os.environ.get("DATABASE_URL_PRIVATE", "").strip()
    if not url:
        sys.exit("DATABASE_URL_PRIVATE is not set. See .env.example.")
    return url


def build_public_url(private_url: str, password: str) -> str:
    """Same host and database, different credentials."""
    parts = urlsplit(private_url)
    host = parts.hostname or ""
    if parts.port:
        host = f"{host}:{parts.port}"
    netloc = f"{ROLE_NAME}:{quote(password, safe='')}@{host}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def write_env_var(name: str, value: str) -> None:
    """Set one variable in .env, leaving every other line untouched."""
    lines = ENV_PATH.read_text(encoding="utf-8").splitlines() if ENV_PATH.exists() else []
    replaced = False
    for i, line in enumerate(lines):
        if line.strip().startswith(f"{name}="):
            lines[i] = f"{name}={value}"
            replaced = True
            break
    if not replaced:
        lines.append(f"{name}={value}")
    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def verify(public_url: str) -> bool:
    """Connect as the public role and try to exceed its grants."""
    import psycopg

    print("\nVerifying the boundary, connected as the public role:")
    ok = True

    with psycopg.connect(public_url) as conn:
        # Must succeed.
        try:
            n = conn.execute("SELECT count(*) FROM v_insights_public").fetchone()[0]
            print(f"  [pass] can read published analyses ({n} visible)")
        except Exception as exc:
            print(f"  [FAIL] cannot read v_insights_public: {exc}")
            ok = False

        # Must all fail. A success here means raw data is reachable publicly.
        for table in ("habits", "repetitions", "scores", "derived_metrics",
                      "metric_catalog", "insights"):
            conn.rollback()
            try:
                conn.execute(f"SELECT * FROM {table} LIMIT 1").fetchone()
                print(f"  [FAIL] CAN READ {table} -- this must not be possible")
                ok = False
            except psycopg.errors.InsufficientPrivilege:
                print(f"  [pass] blocked from {table}")
            except Exception as exc:
                print(f"  [?]    {table}: unexpected error: {type(exc).__name__}")
                ok = False

    return ok


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--prompt", action="store_true",
                        help="type a password instead of generating one")
    args = parser.parse_args()

    try:
        import psycopg
        from psycopg import sql as pgsql
    except ImportError:
        sys.exit("psycopg is not installed. Run: pip install -r requirements.txt")

    private_url = load_private_url()

    if args.prompt:
        import getpass
        password = getpass.getpass("Password for habits_public_ro: ")
        if len(password) < 12:
            sys.exit("Too short. Use at least 12 characters, or omit --prompt to generate one.")
        if password != getpass.getpass("Confirm: "):
            sys.exit("Passwords did not match.")
    else:
        password = secrets.token_urlsafe(24)
        print("Generated a random password for the public role.")

    host = urlsplit(private_url).hostname
    print(f"Database: {host}")

    with psycopg.connect(private_url, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_roles WHERE rolname = %s", (ROLE_NAME,)
        ).fetchone()

        # Identifiers cannot be parameterised; pgsql.Identifier quotes safely.
        # The password is passed as a literal, escaped by psycopg, never
        # interpolated into the string by hand.
        if exists:
            conn.execute(pgsql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD {}").format(
                pgsql.Identifier(ROLE_NAME), pgsql.Literal(password)))
            print(f"Role {ROLE_NAME} already existed -- password updated.")
        else:
            conn.execute(pgsql.SQL("CREATE ROLE {} WITH LOGIN PASSWORD {}").format(
                pgsql.Identifier(ROLE_NAME), pgsql.Literal(password)))
            print(f"Role {ROLE_NAME} created.")

        conn.execute(ROLES_SQL.read_text(encoding="utf-8"))
        print("Applied db/roles.sql (public view + grants).")

    public_url = build_public_url(private_url, password)
    write_env_var("DATABASE_URL_PUBLIC", public_url)
    print(f"Wrote DATABASE_URL_PUBLIC to .env (password not shown).")

    if verify(public_url):
        print("\nBoundary verified. The public role can read published analyses "
              "and nothing else.")
    else:
        sys.exit("\nVerification FAILED. Do not deploy the web app until this passes.")


if __name__ == "__main__":
    main()
