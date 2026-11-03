"""The fork's native time-of-day habits (types 10, 11, 12) must load as HH:MM habits.

Entries hold 1000 + minutes since midnight. A backup containing such a habit used to abort the
whole sync with "unknown Loop habit type".
"""

import sqlite3

import pytest

from pipeline import encoding
from pipeline.ingest import loader


class TestEncoding:
    @pytest.mark.parametrize("loop_type", [10, 11, 12])
    def test_types_are_numerical(self, loop_type):
        assert encoding.is_time_of_day_type(loop_type)
        assert encoding.habit_type_to_value_type(loop_type) == "numerical"

    def test_other_types_unchanged(self):
        assert encoding.habit_type_to_value_type(0) == "boolean"
        assert encoding.habit_type_to_value_type(1) == "numerical"
        assert not encoding.is_time_of_day_type(0)
        with pytest.raises(ValueError):
            encoding.habit_type_to_value_type(2)

    @pytest.mark.parametrize(
        "raw,expected",
        [
            (1000 + 7 * 60 + 30, 7300),   # 07:30
            (1000, 0),                     # midnight is a real time, not "no entry"
            (1000 + 23 * 60 + 59, 23590),  # 23:59
            (2, None),                     # an old "yes" written by a widget
            (0, None),
            (-1, None),
            (None, None),
        ],
    )
    def test_entry_to_hhmm(self, raw, expected):
        assert encoding.time_of_day_to_hhmm(raw) == expected

    @pytest.mark.parametrize(
        "minutes,expected",
        [(480, 8.0), (1410, 23.3), (1380, 23.0), (0, None), (None, None), (-1, None)],
    )
    def test_target(self, minutes, expected):
        assert encoding.time_target_to_decimal(minutes) == expected


def _backup(tmp_path, habits, repetitions):
    path = tmp_path / "backup.db"
    conn = sqlite3.connect(path)
    conn.execute(
        """CREATE TABLE Habits (id INTEGER PRIMARY KEY, uuid TEXT, name TEXT, description TEXT,
           question TEXT, unit TEXT, type INTEGER, target_type INTEGER, target_value REAL,
           freq_num INTEGER, freq_den INTEGER, color INTEGER, position INTEGER, archived INTEGER)"""
    )
    conn.execute(
        "CREATE TABLE Repetitions (id INTEGER PRIMARY KEY, habit INTEGER, timestamp INTEGER, "
        "value INTEGER, notes TEXT)"
    )
    conn.executemany("INSERT INTO Habits VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)", habits)
    conn.executemany("INSERT INTO Repetitions VALUES (?,?,?,?,?)", repetitions)
    conn.commit()
    conn.close()
    return path


DAY = 86_400_000
FIRST_DAY = 1_793_491_200_000  # 2026-11-01 at 00:00 UTC


class TestLoader:
    def test_backup_with_time_of_day_habits_loads(self, tmp_path):
        habits = [
            (1, "u-yes", "Meditate", "", "", "", 0, 0, 0.0, 1, 1, 8, 0, 0),
            (2, "u-wake", "Wake up", "", "", "", 11, 1, 480.0, 1, 1, 8, 1, 0),   # before 08:00
            (3, "u-bed", "Bedtime", "", "", "", 12, 0, 0.0, 1, 1, 8, 2, 0),      # no target
        ]
        reps = [
            (1, 1, FIRST_DAY, 2, None),
            (2, 2, FIRST_DAY, 1000 + 7 * 60 + 30, None),
            (3, 2, FIRST_DAY + DAY, 1000, None),        # midnight
            (4, 2, FIRST_DAY + 2 * DAY, -1, None),      # cleared
            (5, 3, FIRST_DAY, 1000 + 23 * 60 + 15, None),
        ]
        loaded, repetitions = loader.load_backup(_backup(tmp_path, habits, reps))

        by_name = {h.name: h for h in loaded}
        wake, bed = by_name["Wake up"], by_name["Bedtime"]
        assert (wake.value_type, wake.unit) == ("numerical", "HH:MM")
        assert (wake.target_type, wake.target_value) == ("at_most", 8.0)
        assert (bed.value_type, bed.unit) == ("numerical", "HH:MM")
        assert (bed.target_type, bed.target_value) == (None, None)
        assert by_name["Meditate"].value_type == "boolean"

        values = {(r.loop_uuid, r.entry_date.day): r for r in repetitions}
        assert values[("u-wake", 1)].value == pytest.approx(7.5)
        assert values[("u-wake", 2)].value == pytest.approx(0.0)
        assert values[("u-wake", 3)].value is None
        assert values[("u-bed", 1)].value == pytest.approx(23.25)
        assert values[("u-yes", 1)].status == "yes"
        # The stored raw value is kept as written by the app.
        assert values[("u-wake", 1)].raw_value == 1000 + 7 * 60 + 30
