"""Read a Loop Habits SQLite backup and normalise it for Postgres.

This replaces the original src/loader.py. Two things changed deliberately:

  * It takes an explicit path instead of always globbing data/raw, so the Drive
    sync job can hand it a freshly downloaded file.
  * It returns decoded, normalised records rather than raw DataFrames, so the
    Loop-specific encoding stays behind pipeline.encoding and never leaks into
    the database or the analytics code.
"""

from __future__ import annotations

import os
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from pipeline import encoding

DEFAULT_DATA_DIR = Path("data/raw")


@dataclass(frozen=True)
class Habit:
    loop_uuid: str
    name: str
    description: str | None
    question: str | None
    unit: str | None
    value_type: str
    target_type: str | None
    target_value: float | None
    freq_num: int | None
    freq_den: int | None
    color: int | None
    position: int | None
    archived: bool
    # Loop's local integer id. Needed to join repetitions during this import
    # only -- it is never stored, because it is not stable across exports.
    loop_local_id: int


@dataclass(frozen=True)
class Repetition:
    loop_uuid: str
    entry_date: object          # datetime.date
    timestamp_ms: int
    raw_value: int | None
    value: float | None
    status: str | None
    notes: str | None


def find_latest_backup(data_dir: Path | str = DEFAULT_DATA_DIR) -> Path:
    """Newest *.db under data_dir. Raises if there is none."""
    data_dir = Path(data_dir)
    candidates = list(data_dir.glob("*.db"))
    if not candidates:
        raise FileNotFoundError(
            f"No .db backup found in {data_dir}. "
            "Export one from Loop Habits (Settings -> Backup) and put it there."
        )
    return max(candidates, key=os.path.getmtime)


def _connect(path: Path) -> sqlite3.Connection:
    # Read-only: this file is the user's only copy of a backup, and a stray
    # write would corrupt it.
    conn = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def read_habits(conn: sqlite3.Connection) -> list[Habit]:
    rows = conn.execute(
        """
        SELECT id, uuid, name, description, question, unit, type,
               target_type, target_value, freq_num, freq_den,
               color, position, archived
        FROM Habits
        """
    ).fetchall()

    habits: list[Habit] = []
    for row in rows:
        uuid = row["uuid"]
        if not uuid:
            # Without a uuid there is no stable key to upsert on. Skipping is
            # safer than inventing one, which would duplicate the habit on the
            # next sync.
            continue
        habits.append(
            Habit(
                loop_uuid=uuid,
                name=row["name"],
                description=row["description"] or None,
                question=row["question"] or None,
                unit=row["unit"] or None,
                value_type=encoding.habit_type_to_value_type(row["type"]),
                target_type=encoding.target_type_to_str(row["target_type"]),
                target_value=row["target_value"],
                freq_num=row["freq_num"],
                freq_den=row["freq_den"],
                color=row["color"],
                position=row["position"],
                archived=bool(row["archived"]),
                loop_local_id=row["id"],
            )
        )
    return habits


def read_repetitions(
    conn: sqlite3.Connection, habits: list[Habit]
) -> Iterator[Repetition]:
    """Decoded repetitions, joined to habits by Loop's local id."""
    by_local_id = {h.loop_local_id: h for h in habits}

    rows = conn.execute(
        "SELECT habit, timestamp, value, notes FROM Repetitions ORDER BY habit, timestamp"
    )

    for row in rows:
        habit = by_local_id.get(row["habit"])
        if habit is None:
            # Repetition pointing at a habit that no longer exists.
            continue

        raw = row["value"]
        value, status = encoding.decode_repetition(raw, habit.value_type, habit.unit)

        # Loop stores midnight of the entry's day, so reading it back in UTC
        # gives the intended calendar date. Using local time here would shift
        # entries by a day for anyone west of UTC.
        entry_date = datetime.fromtimestamp(row["timestamp"] / 1000, tz=timezone.utc).date()

        yield Repetition(
            loop_uuid=habit.loop_uuid,
            entry_date=entry_date,
            timestamp_ms=row["timestamp"],
            raw_value=raw,
            value=value,
            status=status,
            notes=(row["notes"] or None),
        )


def load_backup(path: Path | str) -> tuple[list[Habit], list[Repetition]]:
    """Read one backup file into normalised habits and repetitions."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"No such backup: {path}")

    with _connect(path) as conn:
        habits = read_habits(conn)
        repetitions = list(read_repetitions(conn, habits))

    return habits, repetitions
