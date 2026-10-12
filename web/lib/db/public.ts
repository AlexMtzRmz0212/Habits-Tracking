/**
 * The public data path.
 *
 * Connects with DATABASE_URL_PUBLIC, which is the habits_public_ro role. That
 * role has SELECT on exactly two views -- v_insights_public and v_site_public
 * -- and no grants at all on habits, repetitions, scores, derived_metrics,
 * metric_catalog or site_blocks.
 *
 * So the queries below are not the thing keeping your habit data private. The
 * database is. If a bug here asked for `SELECT * FROM habits`, Postgres would
 * refuse it. This module simply cannot be made to leak by editing it.
 */

import { neon } from "@neondatabase/serverless";
import type { PublicInsight, SiteBlock } from "@/lib/types";

function publicSql() {
  const url = process.env.DATABASE_URL_PUBLIC;
  if (!url) {
    throw new Error(
      "DATABASE_URL_PUBLIC is not set. Create the role with: " +
        "python scripts/setup_public_role.py"
    );
  }
  return neon(url);
}

function toInsight(row: any): PublicInsight {
  return {
    id: row.id,
    scope: row.scope,
    kind: row.kind,
    title: row.title,
    narrative: row.narrative,
    sqlExample: row.sql_example ?? null,
    metrics: row.metrics ?? {},
    generatedAt:
      row.generated_at instanceof Date
        ? row.generated_at.toISOString()
        : String(row.generated_at),
  };
}

/** Chronological order, undated blocks (headline stats) first. */
export async function getPublicBlocks(): Promise<SiteBlock[]> {
  const sql = publicSql();
  const rows = await sql`
    SELECT id, kind, title, body, payload, sort_date, retired, figures
    FROM v_site_public
    ORDER BY sort_date ASC NULLS FIRST, id
  `;
  return rows.map((row: any) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body ?? "",
    payload: row.payload ?? {},
    sortDate: asDate(row.sort_date),
    retired: row.retired,
    figures: row.figures ?? [],
  }));
}

function asDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value ? String(value) : null;
}

/** Every published analysis, newest first. */
export async function getPublishedInsights(): Promise<PublicInsight[]> {
  const sql = publicSql();
  const rows = await sql`
    SELECT id, scope, kind, title, narrative, sql_example, metrics, generated_at
    FROM v_insights_public
    ORDER BY generated_at DESC, id
  `;
  return rows.map(toInsight);
}

export async function getPublishedInsight(id: number): Promise<PublicInsight | null> {
  const sql = publicSql();
  const rows = await sql`
    SELECT id, scope, kind, title, narrative, sql_example, metrics, generated_at
    FROM v_insights_public
    WHERE id = ${id}
  `;
  return rows.length ? toInsight(rows[0]) : null;
}
