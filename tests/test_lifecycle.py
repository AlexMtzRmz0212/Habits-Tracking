"""Habit lifecycle: what a sync notices about habits appearing and vanishing."""

from pipeline.lifecycle import KnownHabit, plan_events

ACTIVE = KnownHabit(archived=False, removed=False)
ARCHIVED = KnownHabit(archived=True, removed=False)
REMOVED = KnownHabit(archived=False, removed=True)


class TestPlanEvents:
    def test_unchanged_habit_produces_nothing(self):
        assert plan_events({"a": ACTIVE}, {"a": False}) == []

    def test_new_habit_is_first_seen(self):
        assert plan_events({}, {"a": False}) == [("a", "first_seen")]

    def test_new_habit_that_arrives_archived(self):
        assert plan_events({}, {"a": True}) == [
            ("a", "first_seen"),
            ("a", "archived"),
        ]

    def test_habit_missing_from_backup_is_removed(self):
        events = plan_events({"a": ACTIVE, "b": ACTIVE}, {"a": False})
        assert events == [("b", "removed_from_app")]

    def test_removal_is_reported_once(self):
        # Already marked gone, still absent: no second event.
        assert plan_events({"a": ACTIVE, "b": REMOVED}, {"a": False}) == []

    def test_removed_habit_that_returns_is_restored(self):
        assert plan_events({"a": REMOVED}, {"a": False}) == [("a", "restored_to_app")]

    def test_archiving_and_unarchiving(self):
        assert plan_events({"a": ACTIVE}, {"a": True}) == [("a", "archived")]
        assert plan_events({"a": ARCHIVED}, {"a": False}) == [("a", "unarchived")]

    def test_archived_habit_that_is_then_deleted(self):
        assert plan_events({"a": ARCHIVED}, {"b": False}) == [
            ("b", "first_seen"),
            ("a", "removed_from_app"),
        ]

    def test_empty_backup_retires_nothing(self):
        assert plan_events({"a": ACTIVE, "b": ARCHIVED}, {}) == []
