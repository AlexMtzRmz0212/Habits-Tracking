-- ===========================================================================
-- 0002_metric_catalog.sql — make derived metrics independently publishable.
--
-- WHY THIS EXISTS
--
-- 0001 assumed an insight's visibility could be inherited from the habits it
-- was computed from. That is too blunt, because aggregation can declassify:
--
--     "I slept 7.2 hours" does not reveal whether that was 23:00-06:12 or
--     03:00-10:12. The duration destroys the timing.
--
-- So sleep duration can be public while bedtime and wake time stay private,
-- even though the duration is computed from exactly those two private habits.
-- Visibility therefore belongs to the derived metric itself, not to its inputs.
--
-- The catalog holds one row per metric (not per daily value), so publishing a
-- metric is a single deliberate flip, and derived_metrics stays a plain
-- values table.
--
-- SAFETY PROPERTIES
--   * is_public defaults to false, exactly like habits. Silence means private.
--   * source_habits is documentation of lineage for the pipeline and for you.
--     It is NEVER exposed in a public view -- publishing sleep_hours must not
--     reveal that a habit called 'Going sleep' exists.
-- ===========================================================================

CREATE TABLE metric_catalog (
    metric_key   TEXT PRIMARY KEY,
    label        TEXT NOT NULL,
    description  TEXT,
    unit         TEXT,

    -- Private until explicitly published, same rule as habits.
    is_public    BOOLEAN NOT NULL DEFAULT false,

    category_id  INT REFERENCES habit_categories(id) ON DELETE SET NULL,

    -- Which habits feed this metric. Private lineage only: useful for
    -- debugging and for deciding whether publishing is safe, never rendered
    -- on a public page.
    source_habits TEXT[],

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX metric_catalog_public_idx ON metric_catalog (is_public);

-- Every stored value must correspond to a catalogued metric, so a metric can
-- never exist without someone having decided whether it is public.
-- RESTRICT rather than CASCADE: dropping a catalog entry should fail loudly
-- while values still reference it, instead of silently deleting history.
ALTER TABLE derived_metrics
    ADD CONSTRAINT derived_metrics_metric_key_fkey
    FOREIGN KEY (metric_key) REFERENCES metric_catalog (metric_key)
    ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- Insights can now be about a metric rather than a habit, so that a public
-- sleep-duration story can exist without referencing a private habit row.
-- ---------------------------------------------------------------------------
ALTER TABLE insights
    ADD COLUMN metric_key TEXT REFERENCES metric_catalog (metric_key) ON DELETE CASCADE;

-- Widen the scope check to allow metric-scoped insights.
ALTER TABLE insights DROP CONSTRAINT IF EXISTS insights_scope_check;
ALTER TABLE insights
    ADD CONSTRAINT insights_scope_check
    CHECK (scope IN ('habit', 'category', 'global', 'metric'));

CREATE INDEX insights_metric_idx ON insights (metric_key);

INSERT INTO schema_migrations (version) VALUES ('0002_metric_catalog')
ON CONFLICT (version) DO NOTHING;
