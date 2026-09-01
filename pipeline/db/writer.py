"""Write normalised habits and repetitions into Postgres.

Everything here is idempotent: running the same backup twice changes nothing.
That matters because the sync job re-reads whatever Loop last backed up, which
overlaps almost entirely with what is already stored.

THE IMPORTANT RULE IN THIS FILE: an upsert refreshes the fields that come from
Loop, and must never touch is_public or category_id. Those are curated by hand
(scripts/tag_habits.py) and exist nowhere in the backup, so overwriting them on
sync would silently un-curate every habit -- and, because is_public defaults to
false, would quietly unpublish the portfolio instead of leaking. Still wrong,
just wrong in the safe direction.
"""

from __future__ import annotations

from typing import Iterable, Sequence

import psycopg

from pipeline.ingest.loader import Habit, Repetition

# Loop-sourced columns only. is_public and category_id are conspicuously absent.
_UPSERT_HABITS = """
INSERT INTO habits (
    loop_uuid, name, description, question, unit, value_type,
    target_type, target_value, freq_num, freq_den, color, position, archived
)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (loop_uuid) DO UPDATE SET
    name         = EXCLUDED.name,
    description  = EXCLUDED.description,
    question     = EXCLUDED.question,
    unit         = EXCLUDED.unit,
    value_type   = EXCLUDED.value_type,
    target_type  = EXCLUDED.target_type,
    target_value = EXCLUDED.target_value,
    freq_num     = EXCLUDED.freq_num,
    freq_den     = EXCLUDED.freq_den,
    color        = EXCLUDED.color,
    position     = EXCLUDED.position,
    archived     = EXCLUDED.archived,
    updated_at   = now()
"""

_UPSERT_REPETITIONS = """
INSERT INTO repetitions (
    habit_id, entry_date, timestamp_ms, raw_value, value, status, notes
)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (habit_id, entry_date) DO UPDATE SET
    timestamp_ms = EXCLUDED.timestamp_ms,
    raw_value    = EXCLUDED.raw_value,
    value        = EXCLUDED.value,
    status       = EXCLUDED.status,
    notes        = EXCLUDED.notes
"""


def upsert_habits(conn: psycopg.Connection, habits: Sequence[Habit]) -> dict[str, int]:
    """Insert or refresh habits. Returns loop_uuid -> our habits.id."""
    if not habits:
        return {}

    with conn.cursor() as cur:
        cur.executemany(
            _UPSERT_HABITS,
            [
                (
                    h.loop_uuid, h.name, h.description, h.question, h.unit,
                    h.value_type, h.target_type, h.target_value,
                    h.freq_num, h.freq_den, h.color, h.position, h.archived,
                )
                for h in habits
            ],
        )
        # Read the ids back rather than relying on RETURNING, which only reports
        # the rows this statement touched.
        cur.execute("SELECT loop_uuid, id FROM habits")
        return {uuid: hid for uuid, hid in cur.fetchall()}


def upsert_repetitions(
    conn: psycopg.Connection,
    repetitions: Iterable[Repetition],
    habit_ids: dict[str, int],
    batch_size: int = 5000,
) -> int:
    """Insert or refresh repetitions. Returns the number of rows written."""
    written = 0
    batch: list[tuple] = []

    def flush() -> None:
        nonlocal written, batch
        if not batch:
            return
        with conn.cursor() as cur:
            cur.executemany(_UPSERT_REPETITIONS, batch)
        written += len(batch)
        batch = []

    for rep in repetitions:
        habit_id = habit_ids.get(rep.loop_uuid)
        if habit_id is None:
            # The habit was skipped upstream (no uuid); its entries have nowhere
            # to attach.
            continue
        batch.append(
            (
                habit_id, rep.entry_date, rep.timestamp_ms,
                rep.raw_value, rep.value, rep.status, rep.notes,
            )
        )
        if len(batch) >= batch_size:
            flush()

    flush()
    return written


# ---------------------------------------------------------------------------
# sync_runs: an audit trail, and the basis for skipping unchanged backups.
# ---------------------------------------------------------------------------

def start_sync_run(
    conn: psycopg.Connection,
    source_file_name: str | None = None,
    source_modified_time=None,
    source_md5: str | None = None,
) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sync_runs (status, source_file_name, source_modified_time, source_md5)
            VALUES ('running', %s, %s, %s)
            RETURNING id
            """,
            (source_file_name, source_modified_time, source_md5),
        )
        return cur.fetchone()[0]


def finish_sync_run(
    conn: psycopg.Connection,
    run_id: int,
    status: str,
    rows_upserted: int | None = None,
    error_message: str | None = None,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE sync_runs
               SET status = %s,
                   rows_upserted = %s,
                   error_message = %s,
                   finished_at = now()
             WHERE id = %s
            """,
            (status, rows_upserted, error_message, run_id),
        )


def last_successful_sync(conn: psycopg.Connection) -> dict | None:
    """Metadata of the last successful sync, for change detection."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT source_file_name, source_modified_time, source_md5
            FROM sync_runs
            WHERE status = 'success'
            ORDER BY started_at DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
    if row is None:
        return None
    return {"source_file_name": row[0], "source_modified_time": row[1], "source_md5": row[2]}
