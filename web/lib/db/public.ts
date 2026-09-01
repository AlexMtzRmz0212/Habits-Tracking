/**
 * The public data path.
 *
 * Connects with DATABASE_URL_PUBLIC, which is the habits_public_ro role. That
 * role has SELECT on exactly one view -- v_insights_public -- and no grants at
 * all on habits, repetitions, scores, derived_metrics or metric_catalog.
 *
 * So the queries below are not the thing keeping your habit data private. The
 * database is. If a bug here asked for `SELECT * FROM habits`, Postgres would
 * refuse it. This module simply cannot be made to leak by editing it.
 */

import { neon } from "@neondatabase/serverless";
import type { PublicInsight } from "@/lib/types";

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
