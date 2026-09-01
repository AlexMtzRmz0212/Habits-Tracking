/**
 * The private data path. Full database access, behind the PIN.
 *
 * DESIGN RULE: this module never exports a connection, a client, or a query
 * helper. It exports only finished accessors, and every one of them calls
 * requireUnlocked() first.
 *
 * The reason is that the usual arrangement -- export a `db` object, remember
 * to check auth in each page -- fails the moment someone forgets once, and
 * that failure is invisible until it isn't. Here there is nothing to forget:
 * the check is inside the only thing you can call. Even if a public page
 * imported this file (which ESLint also forbids), every call would throw.
 *
 * `import "server-only"` makes it a build error to pull this into a client
 * component, where the connection string would be shipped to the browser.
 */

import "server-only";

import { neon } from "@neondatabase/serverless";
import { isUnlocked } from "@/lib/session";
import type { DashboardStats, PrivateInsight } from "@/lib/types";

export class LockedError extends Error {
  constructor() {
    super("Private data requested without an unlocked session.");
    this.name = "LockedError";
  }
}

async function requireUnlocked() {
  if (!(await isUnlocked())) {
    throw new LockedError();
  }
  const url = process.env.DATABASE_URL_PRIVATE;
  if (!url) {
    throw new Error("DATABASE_URL_PRIVATE is not set.");
  }
  return neon(url);
}

function toPrivateInsight(row: any): PrivateInsight {
  return {
    id: row.id,
    slug: row.slug,
    scope: row.scope,
    kind: row.kind,
    title: row.title,
    narrative: row.narrative,
    sqlExample: row.sql_example ?? null,
    metrics: row.metrics ?? {},
    isPublic: row.is_public,
    habitId: row.habit_id ?? null,
    metricKey: row.metric_key ?? null,
    generatedAt:
      row.generated_at instanceof Date
        ? row.generated_at.toISOString()
        : String(row.generated_at),
  };
}

/** Every analysis, published or not. */
export async function getAllInsights(): Promise<PrivateInsight[]> {
  const sql = await requireUnlocked();
  const rows = await sql`
    SELECT id, slug, habit_id, metric_key, scope, kind, title,
           narrative, sql_example, metrics, is_public, generated_at
    FROM insights
    ORDER BY is_public DESC, kind, slug
  `;
  return rows.map(toPrivateInsight);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const sql = await requireUnlocked();
  const [row] = await sql`
    SELECT
      (SELECT count(*) FROM habits)                          AS habits,
      (SELECT count(*) FROM repetitions)                     AS repetitions,
      (SELECT min(entry_date) FROM repetitions)              AS first_entry,
      (SELECT max(entry_date) FROM repetitions)              AS last_entry,
      (SELECT count(*) FROM insights)                        AS analyses,
      (SELECT count(*) FROM insights WHERE is_public)        AS published
  `;
  const asDate = (v: unknown) =>
    v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v) : null;

  return {
    habits: Number(row.habits),
    repetitions: Number(row.repetitions),
    firstEntry: asDate(row.first_entry),
    lastEntry: asDate(row.last_entry),
    analyses: Number(row.analyses),
    published: Number(row.published),
  };
}

/** Sleep duration over time, for the private dashboard's headline chart. */
export async function getSleepSeries(): Promise<Array<{ date: string; value: number }>> {
  const sql = await requireUnlocked();
  const rows = await sql`
    SELECT entry_date, value
    FROM derived_metrics
    WHERE metric_key = 'sleep_hours'
    ORDER BY entry_date
  `;
  return rows.map((r: any) => ({
    date:
      r.entry_date instanceof Date
        ? r.entry_date.toISOString().slice(0, 10)
        : String(r.entry_date),
    value: Number(r.value),
  }));
}

/** Most-tracked habits with their completion rate. Private by definition. */
export async function getHabitSummary(limit = 20) {
  const sql = await requireUnlocked();
  const rows = await sql`
    SELECT h.name,
           h.value_type,
           h.archived,
           count(r.id)                                       AS entries,
           count(*) FILTER (WHERE r.status = 'yes')          AS done,
           count(*) FILTER (WHERE r.status IN ('yes','no'))  AS tracked
    FROM habits h
    LEFT JOIN repetitions r ON r.habit_id = h.id
    GROUP BY h.id, h.name, h.value_type, h.archived
    ORDER BY count(r.id) DESC
    LIMIT ${limit}
  `;
  return rows.map((r: any) => ({
    name: r.name as string,
    valueType: r.value_type as string,
    archived: r.archived as boolean,
    entries: Number(r.entries),
    completionPct:
      Number(r.tracked) > 0
        ? Math.round((100 * Number(r.done)) / Number(r.tracked))
        : null,
  }));
}
