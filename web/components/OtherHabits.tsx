"use client";

import { useMemo, useState } from "react";

import BlockControls from "@/components/BlockControls";
import HabitCalendar from "@/components/HabitCalendar";
import { STATUS_LABEL } from "@/lib/story";
import type { HabitStatus } from "@/lib/types";

/**
 * Every habit, as a searchable list.
 *
 * Every habit gets a block, but most will never be written about, so they
 * aren't shown as cards. They wait here until you want one: search for it,
 * add the why, and on the next refresh it moves up into the cards. Habits that
 * already have a story stay listed (so filters like "Retired" find them) but
 * are edited in their card, not here.
 *
 * Rendered only by the dashboard, after the session check, so the titles it
 * receives as props are not shipped to a locked visitor.
 */

/**
 * A calendar is thousands of SVG squares for a long habit, so it is drawn only
 * once its row is opened. Rendering all of them up front, hidden, made the
 * whole dashboard slow.
 */
function LazyCalendar({ calendar }: { calendar: { start: string; days: string } }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="other-habits-calendar"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="meta">Calendar</summary>
      {open && <HabitCalendar start={calendar.start} days={calendar.days} />}
    </details>
  );
}

export interface OtherHabit {
  id: number;
  title: string;
  body: string;
  isPublic: boolean;
  retired: boolean;
  /** Already shown as a card above, so it isn't edited from this list. */
  hasStory: boolean;
  status: HabitStatus;
  span: string | null;
  /** ISO dates, for sorting. */
  firstEntry: string | null;
  lastEntry: string | null;
  entries: number;
  calendar: { start: string; days: string } | null;
}

type Filter = "all" | HabitStatus;
type Sort =
  | "name"
  | "name-desc"
  | "newest"
  | "oldest"
  | "recent"
  | "stale"
  | "entries";

const SORT_LABEL: Record<Sort, string> = {
  name: "Name A–Z",
  "name-desc": "Name Z–A",
  newest: "Started: newest",
  oldest: "Started: oldest",
  recent: "Last logged: most recent",
  stale: "Last logged: oldest",
  entries: "Most entries",
};

/** ISO dates compare correctly as strings. Habits with no date sort last. */
function byDate(pick: (h: OtherHabit) => string | null, direction: 1 | -1) {
  return (a: OtherHabit, b: OtherHabit) => {
    const x = pick(a);
    const y = pick(b);
    if (x === y) return a.title.localeCompare(b.title);
    if (x === null) return 1;
    if (y === null) return -1;
    return x < y ? -direction : direction;
  };
}

const COMPARE: Record<Sort, (a: OtherHabit, b: OtherHabit) => number> = {
  name: (a, b) => a.title.localeCompare(b.title),
  "name-desc": (a, b) => b.title.localeCompare(a.title),
  newest: byDate((h) => h.firstEntry, -1),
  oldest: byDate((h) => h.firstEntry, 1),
  recent: byDate((h) => h.lastEntry, -1),
  stale: byDate((h) => h.lastEntry, 1),
  entries: (a, b) => b.entries - a.entries || a.title.localeCompare(b.title),
};

export default function OtherHabits({ habits }: { habits: OtherHabit[] }) {
  const [query, setQuery] = useState("");
  // The habits worth going through first: archived ones, the longest-idle at
  // the top.
  const [filter, setFilter] = useState<Filter>("archived");
  const [sort, setSort] = useState<Sort>("stale");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return habits
      .filter(
        (h) =>
          (filter === "all" || h.status === filter) &&
          (!needle || h.title.toLowerCase().includes(needle))
      )
      .sort(COMPARE[sort]);
  }, [habits, query, filter, sort]);

  return (
    <section className="other-habits">
      <p className="meta">{habits.length} habits</p>

      <div className="other-habits-filters">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search habits"
          aria-label="Search habits"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          aria-label="Filter by status"
        >
          <option value="all">All</option>
          <option value="active">{STATUS_LABEL.active}</option>
          <option value="archived">{STATUS_LABEL.archived}</option>
          <option value="removed_from_app">{STATUS_LABEL.removed_from_app}</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort by"
        >
          {(Object.keys(SORT_LABEL) as Sort[]).map((key) => (
            <option key={key} value={key}>
              {SORT_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      {matches.length === 0 ? (
        <p className="meta">No habits match.</p>
      ) : (
        <ul className="other-habits-list">
          {matches.map((habit) => (
            <li key={habit.id}>
              <div className="other-habits-head">
                <strong>{habit.title}</strong>
                <span className="meta">
                  {STATUS_LABEL[habit.status]}
                  {habit.span ? ` · ${habit.span}` : ""}
                </span>
              </div>
              {habit.calendar && <LazyCalendar calendar={habit.calendar} />}
              {habit.hasStory ? (
                <p className="meta other-habits-story">
                  Has a story: edit it in the cards above.
                </p>
              ) : (
                <BlockControls
                  id={habit.id}
                  isPublic={habit.isPublic}
                  title={habit.title}
                  body={habit.body}
                  retired={habit.retired}
                  editable
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
