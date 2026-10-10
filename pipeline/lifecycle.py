"""Work out what happened to each habit between two syncs.

Pure functions, no database, so the rules can be tested without one.

Loop only ever hands us the habits that still exist. A habit you deleted is
simply absent from the newest backup -- which is the whole signal. Nothing in
the sync deletes it from Postgres, so its row and entries remain; this module
is what notices the absence and turns it into an event.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class KnownHabit:
    """What the database remembered about a habit before this sync."""

    archived: bool
    removed: bool  # already marked as gone from the app


def plan_events(
    known: Mapping[str, KnownHabit],
    incoming: Mapping[str, bool],
) -> list[tuple[str, str]]:
    """Return (loop_uuid, event) pairs for everything that changed.

    `incoming` maps each habit in the new backup to its archived flag.

    An empty backup produces no events at all. A truncated or wrong export
    must not be able to retire every habit in one run; if you really have
    deleted everything, nothing is lost by it being noticed on the next sync.
    """
    if not incoming:
        return []

    events: list[tuple[str, str]] = []

    for uuid in sorted(incoming):
        archived = incoming[uuid]
        before = known.get(uuid)

        if before is None:
            events.append((uuid, "first_seen"))
            if archived:
                events.append((uuid, "archived"))
            continue

        if before.removed:
            events.append((uuid, "restored_to_app"))
        if archived and not before.archived:
            events.append((uuid, "archived"))
        elif before.archived and not archived:
            events.append((uuid, "unarchived"))

    for uuid in sorted(known):
        if uuid not in incoming and not known[uuid].removed:
            events.append((uuid, "removed_from_app"))

    return events
