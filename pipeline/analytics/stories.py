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
from datetime import timedelta
from statistics import median

# Habits whose honest measure is "how many weeks" rather than "how many days":
# done about once a week, so a daily done-rate says little. Matched by name
# pattern, like the sleep metrics, so no real habit name is committed here.
WEEKLY_CADENCE_PATTERNS = ["%grocer%"]

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


# The journal starts in the first month where at least two habits were logged.
# One habit tried for a few days beforehand is a false start, not the journal,
# and counting it made the "Tracking since" stat disagree with the cover.
_JOURNAL_START = """
SELECT min(r.entry_date)
FROM repetitions r
WHERE r.entry_date >= (
    SELECT date_trunc('month', entry_date)::date
    FROM repetitions
    GROUP BY date_trunc('month', entry_date)
    HAVING count(DISTINCT habit_id) >= 2
    ORDER BY 1
    LIMIT 1
)
"""


def headline_stats(conn) -> int:
    habits, entries = conn.execute(
        "SELECT (SELECT count(*) FROM habits), "
        "       (SELECT count(*) FROM repetitions)"
    ).fetchone()
    first_entry = conn.execute(_JOURNAL_START).fetchone()[0]

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


def weekly_cadence(yes_days, first_day, last_day) -> dict | None:
    """How often a roughly-weekly habit was actually done.

    Weeks run Monday to Sunday, from the week of `first_day` to the week of
    `last_day` inclusive (the partial first and last weeks count as weeks). A
    week is "done" if at least one day in it is. Gaps are the days between one
    done day and the next, so a missed week shows up as a gap of 8 or more.
    Returns None when the habit was never done.

    Besides the headline numbers, `weeks` has one entry per week (how many
    days that week were done, zero for a missed week) and `gaps` has one entry
    per gap, dated by the day it ended, which is what the charts draw.
    """
    days = sorted(set(yes_days))
    if not days:
        return None

    def monday(day):
        return day - timedelta(days=day.weekday())

    gaps = [(later - earlier).days for earlier, later in zip(days, days[1:])]
    done_per_week: dict = {}
    for day in days:
        done_per_week[monday(day)] = done_per_week.get(monday(day), 0) + 1

    first_week, last_week = monday(first_day), monday(last_day)
    total = (last_week - first_week).days // 7 + 1
    weeks = [
        {
            "week": (first_week + timedelta(weeks=i)).isoformat(),
            "done": done_per_week.get(first_week + timedelta(weeks=i), 0),
        }
        for i in range(total)
    ]
    return {
        "weeksDone": len(done_per_week),
        "weeksTotal": total,
        "medianGap": median(gaps) if gaps else None,
        "meanGap": round(sum(gaps) / len(gaps), 1) if gaps else None,
        "longestGap": max(gaps) if gaps else None,
        "weeks": weeks,
        "gaps": [
            {"date": later.isoformat(), "days": (later - earlier).days}
            for earlier, later in zip(days, days[1:])
        ],
    }


def weekly_cadences(conn):
    """(habit id, name, cadence) for each weekly habit that was ever done."""
    for pattern in WEEKLY_CADENCE_PATTERNS:
        habits = conn.execute(
            "SELECT id, name FROM habits "
            "WHERE value_type = 'boolean' AND name ILIKE %s ORDER BY id",
            (pattern,),
        ).fetchall()
        for hid, name in habits:
            rows = conn.execute(
                "SELECT entry_date, status FROM repetitions "
                "WHERE habit_id = %s AND status IN ('yes', 'no')",
                (hid,),
            ).fetchall()
            if not rows:
                continue
            tracked = [day for day, _ in rows]
            cadence = weekly_cadence(
                [day for day, status in rows if status == "yes"],
                min(tracked),
                max(tracked),
            )
            if cadence is not None:
                yield hid, name, cadence


def cadence_stats(conn) -> int:
    """Headline stats for weekly habits, as private `stat` blocks.

    They land on the dashboard's Stats tab like the other headline numbers:
    hidden until you choose to show them, and the wording stays yours.
    """
    written = 0
    for hid, name, cadence in weekly_cadences(conn):
        stats = [
            (
                f"stat-cadence-{hid}-weeks",
                f"{name}: weeks done",
                f"{cadence['weeksDone']} of {cadence['weeksTotal']}",
            ),
            (
                f"stat-cadence-{hid}-gap",
                f"{name}: typical gap between",
                f"{cadence['medianGap']:g} days" if cadence["medianGap"] is not None else None,
            ),
            (
                f"stat-cadence-{hid}-longest",
                f"{name}: longest gap",
                f"{cadence['longestGap']} days" if cadence["longestGap"] is not None else None,
            ),
        ]
        for slug, title, value in stats:
            if value is None:
                continue
            conn.execute(
                _UPSERT_BLOCK,
                (slug, "stat", None, title, json.dumps({"value": value}), None),
            )
            written += 1
    return written


def graph_blocks(conn) -> int:
    """Chart data as site blocks, so each graph has its own show/hide switch.

    Each weekly habit gets three blocks: weeks, gaps and the gap histogram. The sleep block carries
    every night as [date, hours asleep, bedtime, wake-up] (clock times in hours
    after midnight, negative for the evening before); the dashboard and the
    public page draw it with the same component.
    """
    written = 0
    summary_keys = ("weeksDone", "weeksTotal", "medianGap", "meanGap", "longestGap")
    for hid, name, c in weekly_cadences(conn):
        summary = {key: c[key] for key in summary_keys}
        # One block per graph, so each has its own show/hide switch. `group`
        # ties a habit's graphs together without putting its name in the data.
        parts = {
            "weeks": {"weeks": c["weeks"]},
            "gaps": {"gaps": c["gaps"]},
            "histogram": {"gaps": c["gaps"]},
        }
        for chart, data in parts.items():
            payload = {
                "type": "cadence",
                "group": f"cadence-{hid}",
                "chart": chart,
                "summary": summary,
                **data,
            }
            conn.execute(
                _UPSERT_BLOCK,
                (f"graph-cadence-{hid}-{chart}", "graph", hid, name, json.dumps(payload), None),
            )
            written += 1

    nights = conn.execute(
        """
        SELECT s.entry_date, s.value, b.value, w.value
        FROM derived_metrics s
        JOIN derived_metrics b ON b.entry_date = s.entry_date AND b.metric_key = 'bed_clock'
        JOIN derived_metrics w ON w.entry_date = s.entry_date AND w.metric_key = 'wake_clock'
        WHERE s.metric_key = 'sleep_hours'
        ORDER BY s.entry_date
        """
    ).fetchall()
    if nights:
        payload = {
            "type": "sleep",
            "nights": [
                [day.isoformat(), float(sleep), float(bed), float(wake)]
                for day, sleep, bed, wake in nights
            ],
        }
        conn.execute(
            _UPSERT_BLOCK,
            ("graph-sleep", "graph", None, "Sleep and awake time", json.dumps(payload), None),
        )
        written += 1
    return written


def run_all(conn) -> int:
    n_stories = habit_stories(conn)
    n_stats = headline_stats(conn) + cadence_stats(conn)
    n_graphs = graph_blocks(conn)
    print(f"  {n_stories} habit stories, {n_stats} headline stats, {n_graphs} graphs")
    return n_stories + n_stats + n_graphs
