"""Decoding Loop Habits' stored values into real numbers.

Everything Loop stores is an integer, and what that integer means depends on the
habit. Getting this wrong is silent — you get plausible-looking numbers that are
off by a factor of 1000, or a bedtime of 24:50 — so the rules are isolated here
and covered by tests rather than scattered through the pipeline.

Verified against a real backup: 150 habits, 20,238 repetitions.
"""

from __future__ import annotations

from datetime import time

# Loop multiplies every numerical entry by 1000 before storing it.
NUMERIC_SCALE = 1000

# Boolean habits store a status code in the same `value` column.
# 1 (YES_AUTO) appears when Loop fills a day in automatically for a habit whose
# frequency means it isn't due; it counts as a completion just like 2.
_BOOLEAN_STATUS = {
    2: "yes",
    1: "yes",
    0: "no",
    3: "skip",
    -1: "unknown",
}

# Units whose decimal is really two sexagesimal-ish fields rather than a
# quantity: 2.45 means 2h45 (or 2m45s), not "two point four five".
_HH_MM = "HH:MM"
_MM_SS = "MM:SS"
TIME_UNITS = frozenset({_HH_MM, _MM_SS})


# The user's fork of Loop has native time-of-day habits: "time of day" (10), "wake up" (11) and
# "bedtime" (12). Their entries hold 1000 + minutes since midnight, so they never clash with the
# boolean status codes. To the rest of the pipeline they are ordinary HH:MM numerical habits, which
# the analyses and the site already understand.
TIME_OF_DAY_TYPES = frozenset({10, 11, 12})
TIME_OF_DAY_BASE = 1000


def is_time_of_day_type(loop_type: int) -> bool:
    return loop_type in TIME_OF_DAY_TYPES


def time_of_day_to_hhmm(raw: int | None) -> int | None:
    """A time-of-day entry (1000 + minutes) -> the stored HH:MM format of numerical habits.

        1000 + 7*60 + 30 -> 7300 (07:30)       1000 -> 0 (00:00)       2 -> None (not a time)

    Entries that do not hold a time (no, skip, unknown) become None, so they are never read as
    midnight.
    """
    if raw is None or raw < TIME_OF_DAY_BASE:
        return None
    hours, minutes = divmod(raw - TIME_OF_DAY_BASE, 60)
    return hours * NUMERIC_SCALE + minutes * 10


def time_target_to_decimal(minutes: float | None) -> float | None:
    """A time-of-day target in minutes since midnight -> the H.MM decimal HH:MM habits use.

    480 (08:00) -> 8.0, 1410 (23:30) -> 23.3. Zero or missing means "no target".
    """
    if minutes is None or minutes <= 0:
        return None
    hours, mins = divmod(int(minutes), 60)
    return round(hours + mins / 100, 2)


def habit_type_to_value_type(loop_type: int) -> str:
    """Loop's Habits.type -> our value_type."""
    if loop_type == 0:
        return "boolean"
    if loop_type == 1 or is_time_of_day_type(loop_type):
        return "numerical"
    raise ValueError(f"unknown Loop habit type: {loop_type!r}")


def target_type_to_str(loop_target_type: int | None) -> str | None:
    """Loop's Habits.target_type -> readable form."""
    if loop_target_type is None:
        return None
    if loop_target_type == 0:
        return "at_least"
    if loop_target_type == 1:
        return "at_most"
    raise ValueError(f"unknown Loop target_type: {loop_target_type!r}")


def decode_boolean(raw: int | None) -> str:
    """Boolean habit value -> 'yes' | 'no' | 'skip' | 'unknown'.

    Unrecognised codes become 'unknown' rather than raising: a future Loop
    version adding a code should not abort a whole sync.
    """
    if raw is None:
        return "unknown"
    return _BOOLEAN_STATUS.get(raw, "unknown")


def decode_numeric(raw: int | None) -> float | None:
    """Numerical habit value -> the real number the user entered.

    6000 -> 6.0, 1000 -> 1.0, 2450 -> 2.45
    """
    if raw is None:
        return None
    return raw / NUMERIC_SCALE


def is_time_unit(unit: str | None) -> bool:
    return (unit or "").strip() in TIME_UNITS


def decode_sexagesimal(raw: int | None) -> tuple[int, int] | None:
    """Split a stored HH:MM / MM:SS value into its two fields.

    The decimal is read positionally, not arithmetically: 2450 is 2.45 which
    means 2 and 45 -- NOT 2 and 0.45*60. Done with integer arithmetic so no
    float rounding can shift a minute.

        2450 -> (2, 45)      300 -> (0, 30)      23300 -> (23, 30)
         150 -> (0, 15)     2000 -> (2, 0)        4450 -> (4, 45)

    Returns None if the value cannot be a real time (minor field >= 60).
    """
    if raw is None:
        return None
    if raw < 0:
        return None
    major, remainder = divmod(raw, NUMERIC_SCALE)
    minor = remainder // 10          # .450 -> 45
    if minor >= 60:
        return None
    return major, minor


def decode_clock_time(raw: int | None) -> time | None:
    """A stored HH:MM value -> a datetime.time, or None if it isn't a valid one.

    Hours of 24 or more are rejected rather than wrapped: the caller decides
    whether a 25:00 means "1am tomorrow" or a typo, and silently wrapping would
    hide data-entry mistakes.
    """
    parts = decode_sexagesimal(raw)
    if parts is None:
        return None
    hour, minute = parts
    if hour >= 24:
        return None
    return time(hour=hour, minute=minute)


def decode_duration_seconds(raw: int | None, unit: str | None) -> float | None:
    """A stored value -> a duration in seconds, for whichever unit it uses."""
    u = (unit or "").strip()
    if u == _MM_SS:
        parts = decode_sexagesimal(raw)
        if parts is None:
            return None
        minutes, seconds = parts
        return minutes * 60 + seconds
    value = decode_numeric(raw)
    if value is None:
        return None
    if u == "seconds":
        return value
    if u == "minutes":
        return value * 60
    return None


def decode_repetition(
    raw: int | None, value_type: str, unit: str | None
) -> tuple[float | None, str | None]:
    """Decode one repetition into (value, status) as stored in Postgres.

    Boolean habits get a status and no value; numerical habits get a value and
    no status. HH:MM habits are returned as fractional hours (2:45 -> 2.75) so
    that averaging bedtimes in SQL is meaningful -- the raw 2.45 decimal is not
    a number you can do arithmetic on.
    """
    if value_type == "boolean":
        return None, decode_boolean(raw)

    if value_type != "numerical":
        raise ValueError(f"unknown value_type: {value_type!r}")

    if is_time_unit(unit):
        parts = decode_sexagesimal(raw)
        if parts is None:
            return None, None
        major, minor = parts
        return major + minor / 60, None

    return decode_numeric(raw), None
