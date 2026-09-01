"""Produce the environment variables Vercel needs, ready to paste.

    python scripts/vercel_env.py

Writes them to .env.vercel (gitignored) rather than printing them, so the
credentials never land in a terminal log or a chat transcript. Open that file,
paste into Vercel, then delete it.

The database URLs are converted to Neon's POOLED endpoint. Vercel's serverless
functions open a new connection per invocation and would exhaust the direct
connection limit; the pooler is built for exactly that pattern. The pipeline
keeps using the direct endpoint, because migrations need session-level
features the pooler does not carry.
"""

from __future__ import annotations

import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = REPO_ROOT / ".env"
OUT_PATH = REPO_ROOT / ".env.vercel"

NEEDED = [
    "DATABASE_URL_PUBLIC",
    "DATABASE_URL_PRIVATE",
    "SESSION_SECRET",
    "PRIVATE_ACCESS_PIN",
]


def read_env() -> dict[str, str]:
    if not ENV_PATH.exists():
        sys.exit(".env not found. Copy .env.example to .env first.")
    values: dict[str, str] = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def to_pooled(url: str) -> str:
    """Point a Neon URL at the pooled endpoint.

    Neon's pooled host is the same name with '-pooler' appended to the
    endpoint id: ep-foo-123.region.aws.neon.tech
              -> ep-foo-123-pooler.region.aws.neon.tech
    """
    parts = urlsplit(url)
    host = parts.hostname or ""
    if "-pooler." in host or not host:
        return url  # already pooled, or nothing to do

    labels = host.split(".")
    labels[0] = labels[0] + "-pooler"
    pooled_host = ".".join(labels)

    userinfo = ""
    if parts.username:
        userinfo = parts.username
        if parts.password:
            userinfo += f":{parts.password}"
        userinfo += "@"

    netloc = f"{userinfo}{pooled_host}"
    if parts.port:
        netloc += f":{parts.port}"

    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))


def main() -> None:
    env = read_env()

    missing = [k for k in NEEDED if not env.get(k)]
    if missing:
        sys.exit(
            "Missing from .env: " + ", ".join(missing) + "\n"
            "Run scripts/setup_public_role.py if the database URLs are absent."
        )

    out = {
        "DATABASE_URL_PUBLIC": to_pooled(env["DATABASE_URL_PUBLIC"]),
        "DATABASE_URL_PRIVATE": to_pooled(env["DATABASE_URL_PRIVATE"]),
        "SESSION_SECRET": env["SESSION_SECRET"],
        "PRIVATE_ACCESS_PIN": env["PRIVATE_ACCESS_PIN"],
    }

    lines = [
        "# Paste these into Vercel -> Project -> Settings -> Environment Variables.",
        "# Apply each to Production, Preview and Development.",
        "#",
        "# DELETE THIS FILE once they are in Vercel. It is gitignored, but it is",
        "# still four secrets sitting in your working tree.",
        "",
    ]
    lines += [f"{key}={value}" for key, value in out.items()]
    OUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

    pooled = "-pooler." in out["DATABASE_URL_PUBLIC"]
    print(f"Wrote {len(out)} variables to {OUT_PATH.name} (values not shown):")
    for key in out:
        print(f"  {key}")
    print(f"\nDatabase URLs converted to the pooled endpoint: {'yes' if pooled else 'NO -- check them'}")
    print("\nNext: open .env.vercel, paste into Vercel, then delete the file.")


if __name__ == "__main__":
    main()
