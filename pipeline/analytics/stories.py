"""Build the website's blocks: one story per habit, plus a few headline stats.

A block is a frozen snapshot of facts (`payload`) next to words you write
(`title`, `body`) and a decision you make (`is_public`). This job owns the
payload only. It never touches the other three, so re-running it cannot
rewrite your wording or publish something you hid.

A habit you deleted in Loop keeps its block. While the habit is still in the
app its payload is refreshed on every run; the run after it disappears writes
one final payload with status "removed_from_app", and from then on the block
is left exactly as it is.
"""

from __future__ import annotations

import json

_HABIT_FACTS = """
SELECT h.id, h.name, h.value_type, h.target_type, h.target_value, h.unit,
       h.freq_num, h.freq_den, h.archived,
       h.removed_from_app_at IS NOT NULL                               AS removed,
       min(r.entry_date) FILTER (WHERE r.status IN ('yes', 'no'))      AS first_entry,
       max(r.entry_date) FILTER (WHERE r.status IN ('yes', 'no'))      AS last_entry,
       count(*)          FILTER (WHERE r.status IN ('yes', 'no'))      AS tracked,
       count(*)          FILTER (WHERE r.status = 'yes')               AS done
FROM habits h
LEFT JOIN repetitions r ON r.habit_id = h.id
GROUP BY h.id
ORDER BY h.id
"""

# title, body and is_public are in neither the VALUES-on-update nor the SET
# list: a new block starts hidden, and an existing one keeps what you chose.
_UPSERT_BLOCK = """
INSERT INTO site_blocks (slug, kind, habit_id, title, payload, sort_date, is_public)
VALUES (%s, %s, %s, %s, %s, %s, false)
ON CONFLICT (slug) DO UPDATE SET
    habit_id   = COALESCE(EXCLUDED.habit_id, site_blocks.habit_id),
    payload    = EXCLUDED.payload,
    sort_date  = EXCLUDED.sort_date,
    updated_at = now()
"""


_CALENDAR_CHAR = {"yes": "y", "no": "n", "skip": "s"}


def encode_calendar(entries) -> dict | None:
    """Pack a habit's daily results into one character per day.

    `entries` is (date, status) pairs. The result is {"start": first day,
    "days": "yn..s"}: y done, n not done, s skipped, "." nothing recorded.
    One string per habit keeps the snapshot a kilobyte or two instead of a row
    per day, and lets the page draw a calendar without any raw entries.
    """
    entries = sorted(entries)
    if not entries:
        return None
    start, end = entries[0][0], entries[-1][0]
    days = ["."] * ((end - start).days + 1)
    for day, status in entries:
        days[(day - start).days] = _CALENDAR_CHAR.get(status, ".")
    return {"start": start.isoformat(), "days": "".join(days)}


def _calendars(conn) -> dict[int, dict]:
    """Calendars for yes/no habits. Numerical habits have no done/not-done."""
    by_habit: dict[int, list] = {}
    for habit_id, day, status in conn.execute(
        "SELECT r.habit_id, r.entry_date, r.status "
        "FROM repetitions r JOIN habits h ON h.id = r.habit_id "
        "WHERE h.value_type = 'boolean'"
    ).fetchall():
        by_habit.setdefault(habit_id, []).append((day, status))
    return {hid: encode_calendar(rows) for hid, rows in by_habit.items()}


def _iso(value) -> str | None:
    return value.isoformat() if value is not None else None


def _status(archived: bool, removed: bool) -> str:
    if removed:
        return "removed_from_app"
    return "archived" if archived else "active"


def _number(value):
    return float(value) if value is not None else None


def habit_stories(conn) -> int:
    rows = conn.execute(_HABIT_FACTS).fetchall()

    events: dict[int, list[dict]] = {}
    for habit_id, event, occurred_on in conn.execute(
        "SELECT habit_id, event, occurred_on FROM habit_events "
        "ORDER BY occurred_on, id"
    ).fetchall():
        events.setdefault(habit_id, []).append(
            {"event": event, "on": occurred_on.isoformat()}
        )

    calendars = _calendars(conn)

    frozen = {
        slug
        for (slug,) in conn.execute(
            "SELECT slug FROM site_blocks "
            "WHERE kind = 'habit_story' AND payload->>'status' = 'removed_from_app'"
        ).fetchall()
    }

    written = 0
    for (hid, name, value_type, target_type, target_value, unit, freq_num,
         freq_den, archived, removed, first_entry, last_entry, tracked,
         done) in rows:
        slug = f"habit-{hid}"
        # Still gone: leave the final snapshot alone. If the habit came back
        # (restored_to_app), `removed` is false and the block refreshes again.
        if removed and slug in frozen:
            continue

        payload = {
            "status": _status(archived, removed),
            "firstEntry": _iso(first_entry),
            "lastEntry": _iso(last_entry),
            "entries": int(tracked),
            "completionPct": round(100 * done / tracked) if tracked else None,
            "how": {
                "valueType": value_type,
                "targetType": target_type,
                "targetValue": _number(target_value),
                "unit": unit or None,
                "freqNum": freq_num,
                "freqDen": freq_den,
            },
            "events": events.get(hid, []),
        }
        if hid in calendars:
            payload["calendar"] = calendars[hid]
        conn.execute(
            _UPSERT_BLOCK,
            (slug, "habit_story", hid, name, json.dumps(payload), first_entry),
        )
        written += 1
    return written


def headline_stats(conn) -> int:
    habits, entries, first_entry = conn.execute(
        "SELECT (SELECT count(*) FROM habits), "
        "       (SELECT count(*) FROM repetitions), "
        "       (SELECT min(entry_date) FROM repetitions)"
    ).fetchone()

    stats = [
        ("stat-habits", "Habits tracked", habits, None),
        ("stat-entries", "Daily entries", entries, None),
        ("stat-since", "Tracking since", _iso(first_entry), first_entry),
    ]
    for slug, title, value, sort_date in stats:
        conn.execute(
            _UPSERT_BLOCK,
            (slug, "stat", None, title, json.dumps({"value": value}), sort_date),
        )
    return len(stats)


def run_all(conn) -> int:
    n_stories = habit_stories(conn)
    n_stats = headline_stats(conn)
    print(f"  {n_stories} habit stories, {n_stats} headline stats")
    return n_stories + n_stats
