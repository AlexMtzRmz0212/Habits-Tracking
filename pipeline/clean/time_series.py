"""Turning clock times into durations, across midnight.

This is the one genuinely tricky piece of the original project, and the reason
the naive version was wrong: averaging raw clock times is meaningless when the
events straddle midnight. A 'Third Meal' at 00:30 stores as 0.5 and drags the
mean towards morning, which is how that habit ended up averaging 12:38 --
apparently earlier than the second meal at 17:52.

Everything here works in *fractional hours* (02:45 -> 2.75), which is what
pipeline.encoding.decode_repetition produces for HH:MM habits.

Two corrections to the original src/cleaner.py:

  * It called `going_sleep - wake_up` "Sleep_Hours". That is time AWAKE, not
    time asleep. Sleeping is the gap from bedtime to the NEXT wake-up.
  * Its sequence fix skipped an event whenever the previous one was missing,
    silently breaking the chain. Here a gap does not stop the roll-forward.
"""

from __future__ import annotations

HOURS_PER_DAY = 24.0

# A night outside this range is far more likely to be a data-entry slip (or a
# bedtime and wake-up that don't belong to the same night) than a real one.
MIN_PLAUSIBLE_SLEEP = 2.0
MAX_PLAUSIBLE_SLEEP = 16.0


def sleep_duration_hours(bedtime: float | None, wake_time: float | None) -> float | None:
    """Hours slept, given a bedtime and the wake-up that followed it.

    Both are clock times as fractional hours on a 24h clock. The wake-up is
    assumed to be the next one after the bedtime, which is what makes the
    midnight case work:

        bedtime 02:45, wake 10:15  -> 7.5   (both after midnight, same date)
        bedtime 23:30, wake 07:00  -> 7.5   (crossed midnight)
        bedtime 22:00, wake 06:00  -> 8.0

    Returns None if either end is missing.
    """
    if bedtime is None or wake_time is None:
        return None

    duration = wake_time - bedtime
    if duration <= 0:
        # Wake-up reads earlier than bedtime, so the night crossed midnight.
        duration += HOURS_PER_DAY
    return duration


def is_plausible_sleep(hours: float | None) -> bool:
    """Whether a computed night is believable enough to report."""
    if hours is None:
        return False
    return MIN_PLAUSIBLE_SLEEP <= hours <= MAX_PLAUSIBLE_SLEEP


def fix_event_sequence(events: list[float | None]) -> list[float | None]:
    """Roll a day's ordered events forward past midnight where needed.

    Given clock times for events that are known to happen in order (wake, first
    meal, second meal, third meal, bedtime), any event that reads earlier than
    the one before it must belong to the following day. Returns hours measured
    from the first event's day, so later events can exceed 24.

        [9.0, 13.0, 18.0, 0.5, 2.75] -> [9.0, 13.0, 18.0, 24.5, 26.75]

    Unlike the original, a missing event does not break the chain: the
    comparison carries forward from the last event actually present, so one
    skipped meal no longer strands the rest of the evening in the wrong day.
    """
    fixed: list[float | None] = []
    last_seen: float | None = None

    for event in events:
        if event is None:
            fixed.append(None)
            continue

        candidate = event
        if last_seen is not None:
            # Advance by whole days until it is at or after the previous event.
            # A loop rather than a single +24 so a long gap still resolves.
            while candidate < last_seen:
                candidate += HOURS_PER_DAY

        fixed.append(candidate)
        last_seen = candidate

    return fixed


def clock_hours_to_hhmm(hours: float | None) -> str | None:
    """Fractional hours -> 'HH:MM' for display. Wraps past 24h back onto a clock."""
    if hours is None:
        return None
    wrapped = hours % HOURS_PER_DAY
    h = int(wrapped)
    m = int(round((wrapped - h) * 60))
    if m == 60:            # rounding crept up to the next hour
        h, m = (h + 1) % 24, 0
    return f"{h:02d}:{m:02d}"


def circular_mean_hours(values: list[float]) -> float | None:
    """Average a set of clock times without the midnight bug.

    The reason this is not a plain mean: bedtimes of 23:00 and 01:00 average
    arithmetically to 12:00, the exact opposite of the truth. Treating each
    time as an angle and averaging the unit vectors gives 00:00 instead.
    """
    import math

    points = [v for v in values if v is not None]
    if not points:
        return None

    sin_sum = sum(math.sin(2 * math.pi * v / HOURS_PER_DAY) for v in points)
    cos_sum = sum(math.cos(2 * math.pi * v / HOURS_PER_DAY) for v in points)

    if abs(sin_sum) < 1e-12 and abs(cos_sum) < 1e-12:
        # Times spread evenly around the clock: no meaningful average exists.
        return None

    angle = math.atan2(sin_sum / len(points), cos_sum / len(points))
    hours = (angle * HOURS_PER_DAY / (2 * math.pi)) % HOURS_PER_DAY

    # An average of exactly midnight comes back from atan2 as a hair below
    # zero, and Python's modulo turns that into 24.0 rather than 0.0 -- which
    # would render as "24:00". Snap it back.
    if HOURS_PER_DAY - hours < 1e-9:
        return 0.0
    return hours
