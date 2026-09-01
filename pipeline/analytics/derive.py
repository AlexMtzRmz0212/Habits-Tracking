"""Compute derived metrics from raw habit data.

A derived metric is a per-day number that isn't in Loop at all -- sleep
duration, for instance, which has to be reconstructed from a bedtime and the
wake-up that follows it, across midnight.

These land in `derived_metrics`, keyed by a metric_key registered in
`metric_catalog`. Nothing here decides what is public: that is a per-analysis
choice made later, in `insights`.
"""

from __future__ import annotations

from pipeline.clean import time_series as ts

# How a metric finds its inputs. Kept as name patterns rather than hard-coded
# habit ids so a renamed or re-created habit does not silently break the
# metric -- and so no real habit name is committed to the repo.
SLEEP_PATTERNS = {"bedtime": "%sleep%", "wake": "%wake%"}


def _register_metric(conn, metric_key, label, description, unit, source_habits):
    conn.execute(
        """
        INSERT INTO metric_catalog (metric_key, label, description, unit, source_habits)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (metric_key) DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            unit = EXCLUDED.unit,
            source_habits = EXCLUDED.source_habits,
            updated_at = now()
        """,
        (metric_key, label, description, unit, source_habits),
    )


def _find_clock_habit(conn, pattern):
    """The most-recorded HH:MM habit whose name matches, or None."""
    row = conn.execute(
        """
        SELECT h.id, h.loop_uuid, h.name, count(r.id) AS n
        FROM habits h JOIN repetitions r ON r.habit_id = h.id
        WHERE h.unit = 'HH:MM' AND h.name ILIKE %s AND r.value IS NOT NULL
        GROUP BY h.id, h.loop_uuid, h.name
        ORDER BY n DESC
        LIMIT 1
        """,
        (pattern,),
    ).fetchone()
    return row


def derive_sleep_hours(conn, verbose=True):
    """Nightly sleep duration, in hours.

    Pairs each bedtime with the wake-up recorded on the same calendar date --
    which is the right pairing here because bedtimes mostly fall after
    midnight, so both belong to the same date. sleep_duration_hours handles
    the case where the bedtime was instead the previous evening.

    Nights outside a believable range are dropped rather than stored: they are
    almost always a missed entry pairing with the wrong night, and one 22-hour
    "night" badly distorts any average built on top.
    """
    bed = _find_clock_habit(conn, SLEEP_PATTERNS["bedtime"])
    wake = _find_clock_habit(conn, SLEEP_PATTERNS["wake"])
    if bed is None or wake is None:
        if verbose:
            print("  sleep_hours: no bedtime/wake-up habit pair found, skipping")
        return 0

    bed_id, bed_uuid, bed_name, _ = bed
    wake_id, wake_uuid, wake_name, _ = wake

    pairs = conn.execute(
        """
        SELECT b.entry_date, b.value, w.value
        FROM repetitions b
        JOIN repetitions w ON w.habit_id = %s AND w.entry_date = b.entry_date
        WHERE b.habit_id = %s AND b.value IS NOT NULL AND w.value IS NOT NULL
        ORDER BY b.entry_date
        """,
        (wake_id, bed_id),
    ).fetchall()

    _register_metric(
        conn,
        "sleep_hours",
        "Hours slept",
        "Nightly sleep duration, reconstructed from bedtime to the following "
        "wake-up. Handles nights that cross midnight.",
        "hours",
        [bed_uuid, wake_uuid],
    )

    kept = dropped = 0
    for entry_date, bed_value, wake_value in pairs:
        hours = ts.sleep_duration_hours(float(bed_value), float(wake_value))
        if not ts.is_plausible_sleep(hours):
            dropped += 1
            continue
        conn.execute(
            """
            INSERT INTO derived_metrics (metric_key, entry_date, value, unit)
            VALUES ('sleep_hours', %s, %s, 'hours')
            ON CONFLICT (metric_key, entry_date) DO UPDATE SET
                value = EXCLUDED.value, unit = EXCLUDED.unit
            """,
            (entry_date, round(hours, 3)),
        )
        kept += 1

    if verbose:
        print(f"  sleep_hours: {kept} nights stored, {dropped} implausible dropped")
    return kept


DERIVATIONS = [derive_sleep_hours]


def run_all(conn, verbose=True):
    total = 0
    for fn in DERIVATIONS:
        total += fn(conn, verbose=verbose)
    conn.commit()
    return total
