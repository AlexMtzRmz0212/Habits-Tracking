"""Persist analyses as `insights` rows.

One rule matters here: an upsert refreshes the numbers and the prose, and
never touches is_public. The pipeline owns what an analysis SAYS; you own
whether anyone else gets to see it.
"""

from __future__ import annotations

import json

_UPSERT = """
INSERT INTO insights (slug, habit_id, metric_key, scope, kind, title,
                      narrative, sql_example, metrics, is_public, generated_at)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, false, now())
ON CONFLICT (slug) DO UPDATE SET
    habit_id     = EXCLUDED.habit_id,
    metric_key   = EXCLUDED.metric_key,
    scope        = EXCLUDED.scope,
    kind         = EXCLUDED.kind,
    title        = EXCLUDED.title,
    narrative    = EXCLUDED.narrative,
    sql_example  = EXCLUDED.sql_example,
    metrics      = EXCLUDED.metrics,
    generated_at = now()
"""
# is_public is absent from both the VALUES-on-update and the SET list:
# a new analysis starts private, and an existing one keeps whatever you chose.


def save_insight(conn, *, slug, scope, kind, title, narrative,
                 metrics, sql_example=None, habit_id=None, metric_key=None):
    conn.execute(
        _UPSERT,
        (slug, habit_id, metric_key, scope, kind, title,
         narrative, sql_example, json.dumps(metrics)),
    )
