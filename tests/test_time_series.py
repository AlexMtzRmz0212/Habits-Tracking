"""Tests for cross-midnight time handling.

These cover the cases the original implementation got wrong, so they double as
a record of what "correct" means here.
"""

import pytest

from pipeline.clean import time_series as ts


class TestSleepDuration:
    def test_both_after_midnight(self):
        # Bedtime 02:45, up at 10:15 -- the common shape in this dataset.
        assert ts.sleep_duration_hours(2.75, 10.25) == pytest.approx(7.5)

    def test_crosses_midnight(self):
        # Bedtime 23:30, up at 07:00. The naive subtraction gives -16.5.
        assert ts.sleep_duration_hours(23.5, 7.0) == pytest.approx(7.5)

    def test_evening_bedtime(self):
        assert ts.sleep_duration_hours(22.0, 6.0) == pytest.approx(8.0)

    def test_exactly_24h_apart_is_a_full_day(self):
        # Same clock time twice cannot mean zero sleep.
        assert ts.sleep_duration_hours(3.0, 3.0) == pytest.approx(24.0)

    @pytest.mark.parametrize("bed,wake", [(None, 7.0), (23.0, None), (None, None)])
    def test_missing_end_gives_none(self, bed, wake):
        assert ts.sleep_duration_hours(bed, wake) is None

    def test_is_not_time_awake(self):
        # The original called (bedtime - waketime) "Sleep_Hours"; for a 09:00
        # wake and 23:00 bedtime that is 14h AWAKE. Sleep is the other gap.
        assert ts.sleep_duration_hours(23.0, 9.0) == pytest.approx(10.0)


class TestPlausibility:
    @pytest.mark.parametrize("hours", [2.0, 7.5, 16.0])
    def test_accepts_believable_nights(self, hours):
        assert ts.is_plausible_sleep(hours)

    @pytest.mark.parametrize("hours", [0.5, 1.9, 16.1, 23.0, None])
    def test_rejects_the_rest(self, hours):
        assert not ts.is_plausible_sleep(hours)


class TestEventSequence:
    def test_evening_events_roll_past_midnight(self):
        # wake 09:00, meals 13:00 and 18:00, third meal 00:30, bed 02:45
        got = ts.fix_event_sequence([9.0, 13.0, 18.0, 0.5, 2.75])
        assert got == pytest.approx([9.0, 13.0, 18.0, 24.5, 26.75])

    def test_already_ordered_is_untouched(self):
        got = ts.fix_event_sequence([8.0, 12.0, 19.0, 22.0])
        assert got == pytest.approx([8.0, 12.0, 19.0, 22.0])

    def test_gap_does_not_break_the_chain(self):
        # The original skipped an event whenever its predecessor was missing,
        # stranding everything after it in the wrong day.
        got = ts.fix_event_sequence([9.0, None, 18.0, 0.5])
        assert got[0] == pytest.approx(9.0)
        assert got[1] is None
        assert got[2] == pytest.approx(18.0)
        assert got[3] == pytest.approx(24.5)

    def test_leading_none(self):
        got = ts.fix_event_sequence([None, 13.0, 0.5])
        assert got[0] is None
        assert got[1] == pytest.approx(13.0)
        assert got[2] == pytest.approx(24.5)

    def test_all_missing(self):
        assert ts.fix_event_sequence([None, None]) == [None, None]

    def test_empty(self):
        assert ts.fix_event_sequence([]) == []


class TestDisplay:
    @pytest.mark.parametrize(
        "hours,expected",
        [(2.75, "02:45"), (0.5, "00:30"), (23.5, "23:30"), (10.25, "10:15")],
    )
    def test_formats_clock(self, hours, expected):
        assert ts.clock_hours_to_hhmm(hours) == expected

    def test_wraps_rolled_forward_values(self):
        # 26:45 is a real internal value after sequencing; display it as 02:45.
        assert ts.clock_hours_to_hhmm(26.75) == "02:45"

    def test_rounding_up_to_the_next_hour(self):
        assert ts.clock_hours_to_hhmm(9.999) == "10:00"

    def test_none(self):
        assert ts.clock_hours_to_hhmm(None) is None


class TestCircularMean:
    def test_midnight_straddling_average(self):
        # The whole point: 23:00 and 01:00 average to midnight, not midday.
        assert ts.circular_mean_hours([23.0, 1.0]) == pytest.approx(0.0, abs=1e-9)

    def test_plain_average_when_no_wrap(self):
        assert ts.circular_mean_hours([8.0, 10.0]) == pytest.approx(9.0)

    def test_single_value(self):
        assert ts.circular_mean_hours([3.5]) == pytest.approx(3.5)

    def test_empty(self):
        assert ts.circular_mean_hours([]) is None

    def test_evenly_spread_has_no_meaningful_average(self):
        assert ts.circular_mean_hours([0.0, 6.0, 12.0, 18.0]) is None
