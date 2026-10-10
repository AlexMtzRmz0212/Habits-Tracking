"""The compact calendar a habit story is drawn from."""

from datetime import date

from pipeline.analytics.stories import encode_calendar


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
