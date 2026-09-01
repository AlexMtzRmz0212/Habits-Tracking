"""Tests for Loop Habits value decoding.

The expected values here were read off a real backup, so these double as
documentation of the format.
"""

from datetime import time

import pytest

from pipeline import encoding


class TestBoolean:
    @pytest.mark.parametrize(
        "raw,expected",
        [(2, "yes"), (1, "yes"), (0, "no"), (3, "skip"), (-1, "unknown")],
    )
    def test_known_codes(self, raw, expected):
        assert encoding.decode_boolean(raw) == expected

    def test_missing_is_unknown(self):
        assert encoding.decode_boolean(None) == "unknown"

    def test_unrecognised_code_does_not_raise(self):
        # A future Loop version adding a code must not abort an entire sync.
        assert encoding.decode_boolean(99) == "unknown"


class TestNumeric:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            (6000, 6.0),    # "Level of Energy", unit /10
            (1000, 1.0),    # "Brush teeth", unit times
            (2000, 2.0),
            (0, 0.0),
        ],
    )
    def test_scale_of_1000(self, raw, expected):
        assert encoding.decode_numeric(raw) == expected

    def test_none_passes_through(self):
        assert encoding.decode_numeric(None) is None


class TestSexagesimal:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            (2450, (2, 45)),     # real "Going sleep" value -> 02:45
            (4450, (4, 45)),
            (1300, (1, 30)),
            (300, (0, 30)),
            (150, (0, 15)),
            (2000, (2, 0)),
            (23300, (23, 30)),   # the habit's own target, 23.3 -> 23:30
        ],
    )
    def test_positional_not_arithmetic(self, raw, expected):
        # 2450 is 2.45 meaning 2 and 45 -- not 2 and 0.45*60=27.
        assert encoding.decode_sexagesimal(raw) == expected

    def test_rejects_impossible_minute(self):
        # 2.75 would be 75 minutes, which is not a time anyone entered.
        assert encoding.decode_sexagesimal(2750) is None

    def test_rejects_negative(self):
        assert encoding.decode_sexagesimal(-1) is None

    def test_none(self):
        assert encoding.decode_sexagesimal(None) is None


class TestClockTime:
    def test_typical_bedtime(self):
        assert encoding.decode_clock_time(2450) == time(2, 45)

    def test_midnight_ish(self):
        assert encoding.decode_clock_time(150) == time(0, 15)

    def test_late_evening(self):
        assert encoding.decode_clock_time(23300) == time(23, 30)

    def test_rejects_hour_24_and_over(self):
        # Deliberately not wrapped to 00:50 -- that would silently hide a typo.
        assert encoding.decode_clock_time(24500) is None


class TestDuration:
    def test_mm_ss(self):
        assert encoding.decode_duration_seconds(1300, "MM:SS") == 90.0

    def test_seconds_unit(self):
        assert encoding.decode_duration_seconds(45000, "seconds") == 45.0

    def test_minutes_unit(self):
        assert encoding.decode_duration_seconds(2000, "minutes") == 120.0

    def test_unknown_unit_gives_none(self):
        assert encoding.decode_duration_seconds(1000, "reps") is None


class TestDecodeRepetition:
    def test_boolean_yields_status_only(self):
        value, status = encoding.decode_repetition(2, "boolean", None)
        assert (value, status) == (None, "yes")

    def test_numeric_yields_value_only(self):
        value, status = encoding.decode_repetition(6000, "numerical", "/10")
        assert (value, status) == (6.0, None)

    def test_clock_time_becomes_fractional_hours(self):
        # 02:45 -> 2.75, so that AVG() over bedtimes actually means something.
        value, status = encoding.decode_repetition(2450, "numerical", "HH:MM")
        assert value == pytest.approx(2.75)
        assert status is None

    def test_invalid_clock_time_is_dropped_not_guessed(self):
        value, status = encoding.decode_repetition(2750, "numerical", "HH:MM")
        assert value is None

    def test_rejects_unknown_value_type(self):
        with pytest.raises(ValueError):
            encoding.decode_repetition(1, "mystery", None)


class TestHabitMetadata:
    def test_type_mapping(self):
        assert encoding.habit_type_to_value_type(0) == "boolean"
        assert encoding.habit_type_to_value_type(1) == "numerical"

    def test_unknown_type_raises(self):
        # Unlike a stray value code, an unknown habit type means the whole
        # schema assumption is wrong -- fail loudly.
        with pytest.raises(ValueError):
            encoding.habit_type_to_value_type(7)

    def test_target_type_mapping(self):
        assert encoding.target_type_to_str(0) == "at_least"
        assert encoding.target_type_to_str(1) == "at_most"
        assert encoding.target_type_to_str(None) is None
