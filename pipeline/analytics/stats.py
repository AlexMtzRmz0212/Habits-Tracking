"""The analyses themselves.

Each one computes a result, writes a chart-ready payload and a sentence of
prose, and stores the SQL that produced it -- the SQL is part of the point on
a portfolio page, not just an implementation detail.

Every analysis starts private. Publishing is a separate, deliberate act.
"""

from __future__ import annotations

from pipeline.analytics.writer import save_insight
from pipeline.clean import time_series as ts

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday",
            "Friday", "Saturday", "Sunday"]


def _iso(value):
    """Dates are not JSON-serialisable; charts want strings anyway."""
    return value.isoformat() if hasattr(value, "isoformat") else value


# ---------------------------------------------------------------------------

def sleep_duration_summary(conn) -> int:
    sql = """
        SELECT entry_date, value
        FROM derived_metrics
        WHERE metric_key = 'sleep_hours'
        ORDER BY entry_date
    """
    rows = conn.execute(sql).fetchall()
    if len(rows) < 30:
        return 0

    values = [float(v) for _, v in rows]
    n = len(values)
    ordered = sorted(values)
    median = ordered[n // 2]
    mean = sum(values) / n

    # 30-night rolling average: nightly sleep is far too noisy to read as a
    # trend, and the rolling line is what actually shows drift over years.
    window, rolling = 30, []
    running = 0.0
    for i, (date, value) in enumerate(rows):
        running += float(value)
        if i >= window:
            running -= float(rows[i - window][1])
        if i >= window - 1:
            rolling.append({"date": _iso(date), "value": round(running / window, 2)})

    # Histogram in half-hour buckets.
    buckets: dict[float, int] = {}
    for v in values:
        b = round(v * 2) / 2
        buckets[b] = buckets.get(b, 0) + 1

    short = sum(1 for v in values if v < 7)
    pct_short = round(100 * short / n)

    save_insight(
        conn,
        slug="sleep-duration-summary",
        scope="metric",
        metric_key="sleep_hours",
        kind="trend",
        title="How much I actually sleep",
        narrative=(
            f"Across {n} reconstructed nights the median is {median:.1f} hours "
            f"(mean {mean:.1f}). {pct_short}% of nights come in under 7 hours. "
            "Each night is measured from bedtime to the following wake-up, so "
            "the many nights that begin after midnight are counted correctly "
            "rather than coming out negative."
        ),
        sql_example=sql.strip(),
        metrics={
            "summary": {"nights": n, "median": round(median, 2),
                        "mean": round(mean, 2), "pct_under_7h": pct_short,
                        "min": round(min(values), 2), "max": round(max(values), 2)},
            "rolling_30": rolling,
            "histogram": [{"hours": k, "nights": v} for k, v in sorted(buckets.items())],
        },
    )
    return 1


def sleep_by_weekday(conn) -> int:
    sql = """
        SELECT EXTRACT(ISODOW FROM entry_date)::int AS dow,
               round(avg(value), 2) AS avg_hours,
               count(*) AS nights
        FROM derived_metrics
        WHERE metric_key = 'sleep_hours'
        GROUP BY dow
        ORDER BY dow
    """
    rows = conn.execute(sql).fetchall()
    if not rows:
        return 0

    series = [{"weekday": WEEKDAYS[d - 1], "hours": float(a), "nights": n}
              for d, a, n in rows]
    best = max(series, key=lambda r: r["hours"])
    worst = min(series, key=lambda r: r["hours"])

    save_insight(
        conn,
        slug="sleep-by-weekday",
        scope="metric",
        metric_key="sleep_hours",
        kind="trend",
        title="Which nights I sleep best",
        narrative=(
            f"{best['weekday']} nights are the longest at {best['hours']:.1f} hours, "
            f"{worst['weekday']} the shortest at {worst['hours']:.1f} -- a spread of "
            f"{best['hours'] - worst['hours']:.1f} hours across the week."
        ),
        sql_example=sql.strip(),
        metrics={"series": series},
    )
    return 1


def longest_streaks(conn) -> int:
    """Classic gaps-and-islands: consecutive dates share date - row_number()."""
    sql = """
        WITH marked AS (
          SELECT h.id, h.name, r.entry_date,
                 r.entry_date - (row_number() OVER (PARTITION BY h.id
                                                    ORDER BY r.entry_date))::int AS grp
          FROM habits h
          JOIN repetitions r ON r.habit_id = h.id
          WHERE h.value_type = 'boolean' AND r.status = 'yes'
        )
        SELECT name, count(*) AS streak, min(entry_date) AS started, max(entry_date) AS ended
        FROM marked
        GROUP BY id, name, grp
        ORDER BY streak DESC
        LIMIT 10
    """
    rows = conn.execute(sql).fetchall()
    if not rows:
        return 0

    series = [{"habit": name, "days": streak,
               "started": _iso(start), "ended": _iso(end)}
              for name, streak, start, end in rows]
    top = series[0]

    save_insight(
        conn,
        slug="longest-streaks",
        scope="global",
        kind="streak",
        title="Longest unbroken runs",
        narrative=(
            f"The longest streak reached {top['days']} consecutive days "
            f"({top['started']} to {top['ended']}). Streaks are found with a "
            "gaps-and-islands query: consecutive dates share the same value of "
            "date minus row_number(), so each unbroken run groups by itself."
        ),
        sql_example=sql.strip(),
        metrics={"series": series},
    )
    return 1


def completion_by_month(conn) -> int:
    sql = """
        SELECT date_trunc('month', r.entry_date)::date AS month,
               count(*) FILTER (WHERE r.status = 'yes')                    AS done,
               count(*) FILTER (WHERE r.status IN ('yes','no'))            AS tracked,
               round(100.0 * count(*) FILTER (WHERE r.status = 'yes')
                     / NULLIF(count(*) FILTER (WHERE r.status IN ('yes','no')), 0), 1) AS pct
        FROM repetitions r
        JOIN habits h ON h.id = r.habit_id
        WHERE h.value_type = 'boolean'
        GROUP BY month
        HAVING count(*) FILTER (WHERE r.status IN ('yes','no')) > 30
        ORDER BY month
    """
    rows = conn.execute(sql).fetchall()
    if len(rows) < 3:
        return 0

    series = [{"month": _iso(m), "done": d, "tracked": t, "pct": float(p)}
              for m, d, t, p in rows]
    first, last = series[0], series[-1]
    direction = "up" if last["pct"] >= first["pct"] else "down"

    save_insight(
        conn,
        slug="completion-by-month",
        scope="global",
        kind="trend",
        title="Follow-through, month by month",
        narrative=(
            f"Over {len(series)} months, completion of yes/no habits went "
            f"{direction} from {first['pct']:.0f}% to {last['pct']:.0f}%. "
            f"The most recent month covers {last['tracked']} tracked days."
        ),
        sql_example=sql.strip(),
        metrics={"series": series},
    )
    return 1


def bedtime_regularity(conn) -> int:
    """How consistent bedtimes are -- a spread, which reveals no actual time."""
    sql = """
        SELECT r.entry_date, r.value
        FROM repetitions r
        JOIN habits h ON h.id = r.habit_id
        WHERE h.unit = 'HH:MM' AND h.name ILIKE '%sleep%' AND r.value IS NOT NULL
        ORDER BY r.entry_date
    """
    rows = conn.execute(sql).fetchall()
    if len(rows) < 60:
        return 0

    # Group by month and measure the spread of bedtimes within each, using a
    # circular mean so times either side of midnight do not average to midday.
    by_month: dict[str, list[float]] = {}
    for date, value in rows:
        by_month.setdefault(date.strftime("%Y-%m"), []).append(float(value))

    series = []
    for month, values in sorted(by_month.items()):
        if len(values) < 10:
            continue
        centre = ts.circular_mean_hours(values)
        if centre is None:
            continue
        # Distance from the centre, the short way round the clock.
        deviations = []
        for v in values:
            d = abs(v - centre) % 24
            deviations.append(min(d, 24 - d))
        spread = sum(deviations) / len(deviations)
        series.append({"month": month, "spread_hours": round(spread, 2),
                       "nights": len(values)})

    if len(series) < 3:
        return 0

    tightest = min(series, key=lambda r: r["spread_hours"])
    latest = series[-1]

    save_insight(
        conn,
        slug="bedtime-regularity",
        scope="global",
        kind="trend",
        title="How regular my bedtime is",
        narrative=(
            f"Measured as the average distance from each month's typical bedtime, "
            f"the most consistent month varied by {tightest['spread_hours']:.1f} hours "
            f"({tightest['month']}); the latest sits at {latest['spread_hours']:.1f}. "
            "This is a spread, not a time -- it says how steady the routine is "
            "without saying when it happens."
        ),
        sql_example=sql.strip(),
        metrics={"series": series},
    )
    return 1


ANALYSES = [
    sleep_duration_summary,
    sleep_by_weekday,
    longest_streaks,
    completion_by_month,
    bedtime_regularity,
]


def run_all(conn) -> int:
    count = 0
    for fn in ANALYSES:
        made = fn(conn)
        status = "ok" if made else "skipped (not enough data)"
        print(f"  {fn.__name__}: {status}")
        count += made
    return count
