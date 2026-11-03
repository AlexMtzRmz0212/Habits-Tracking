"""The compact calendar a habit story is drawn from."""

from datetime import date

from pipeline.analytics.stories import encode_calendar, weekly_cadence


class TestEncodeCalendar:
    def test_no_entries_means_no_calendar(self):
        assert encode_calendar([]) is None

    def test_one_character_per_day_with_gaps(self):
        entries = [
            (date(2024, 1, 1), "yes"),
            (date(2024, 1, 2), "no"),
            (date(2024, 1, 5), "skip"),
        ]
        assert encode_calendar(entries) == {"start": "2024-01-01", "days": "yn..s"}

    def test_unknown_status_is_left_blank(self):
        assert encode_calendar([(date(2024, 3, 1), "unknown")])["days"] == "."

    def test_input_order_does_not_matter(self):
        entries = [(date(2024, 1, 2), "no"), (date(2024, 1, 1), "yes")]
        assert encode_calendar(entries)["days"] == "yn"

    def test_spans_a_month_boundary(self):
        entries = [(date(2024, 1, 31), "yes"), (date(2024, 2, 2), "yes")]
        assert encode_calendar(entries) == {"start": "2024-01-31", "days": "y.y"}


class TestWeeklyCadence:
    # 2024-01-01 is a Monday.
    def test_never_done_has_no_cadence(self):
        assert weekly_cadence([], date(2024, 1, 1), date(2024, 1, 31)) is None

    def test_weeks_done_counts_each_week_once(self):
        yes = [date(2024, 1, 1), date(2024, 1, 3), date(2024, 1, 10)]
        result = weekly_cadence(yes, date(2024, 1, 1), date(2024, 1, 14))
        assert result["weeksDone"] == 2
        assert result["weeksTotal"] == 2

    def test_a_missed_week_is_a_gap_and_a_week_not_done(self):
        yes = [date(2024, 1, 1), date(2024, 1, 8), date(2024, 1, 22)]
        result = weekly_cadence(yes, date(2024, 1, 1), date(2024, 1, 28))
        assert result["weeksDone"] == 3
        assert result["weeksTotal"] == 4
        assert result["longestGap"] == 14
        assert result["medianGap"] == 10.5

    def test_done_once_has_no_gaps(self):
        result = weekly_cadence([date(2024, 1, 3)], date(2024, 1, 1), date(2024, 1, 7))
        assert result["medianGap"] is None
        assert result["longestGap"] is None

    def test_duplicate_days_do_not_count_twice(self):
        yes = [date(2024, 1, 1), date(2024, 1, 1)]
        assert weekly_cadence(yes, date(2024, 1, 1), date(2024, 1, 1))["weeksDone"] == 1

    def test_weeks_has_one_entry_per_week_including_missed_ones(self):
        yes = [date(2024, 1, 1), date(2024, 1, 3), date(2024, 1, 22)]
        weeks = weekly_cadence(yes, date(2024, 1, 1), date(2024, 1, 28))["weeks"]
        assert [w["week"] for w in weeks] == ["2024-01-01", "2024-01-08", "2024-01-15", "2024-01-22"]
        assert [w["done"] for w in weeks] == [2, 0, 0, 1]

    def test_gaps_are_dated_by_the_day_they_ended(self):
        yes = [date(2024, 1, 1), date(2024, 1, 8), date(2024, 1, 22)]
        gaps = weekly_cadence(yes, date(2024, 1, 1), date(2024, 1, 28))["gaps"]
        assert gaps == [{"date": "2024-01-08", "days": 7}, {"date": "2024-01-22", "days": 14}]

    def test_mean_gap_is_the_average_the_median_is_the_middle(self):
        yes = [date(2024, 1, 1), date(2024, 1, 2), date(2024, 1, 3), date(2024, 1, 23)]
        result = weekly_cadence(yes, date(2024, 1, 1), date(2024, 1, 28))
        assert result["medianGap"] == 1
        assert result["meanGap"] == 7.3
