-- ===========================================================================
-- roles.sql — the database half of the public/private boundary.
--
-- Views and grants only. No password appears here, so this file is safe in a
-- public repo. Creating the role itself (which needs a password) is done by
-- scripts/setup_public_role.py, which also runs this file.
--
-- THE MODEL
--   Habit data is always private and is never served to the public.
--   What gets published is an ANALYSIS: a chart, a statistic, a narrative,
--   precomputed by the pipeline and stored as a row in `insights`.
--
--   habits_public_ro can therefore read exactly one thing: published
--   insights. It has NO grants on habits, repetitions, scores,
--   derived_metrics or metric_catalog. A bug in a public page cannot leak raw
--   habit data, because the connection rendering that page cannot see the
--   tables that hold it.
-- ===========================================================================

-- Published analyses only. Note what is NOT selected:
--   * is_public   -- the filter itself, not data
--   * habit_id    -- publishing an analysis must not disclose which habit row
--                    it came from, nor that a given habit exists
--   * metric_key  -- same reasoning for derived metrics
CREATE OR REPLACE VIEW v_insights_public AS
SELECT id,
       scope,
       kind,
       title,
       narrative,
       sql_example,
       metrics,
       generated_at
FROM insights
WHERE is_public;

-- Start from zero, so re-running this can only ever tighten access.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM habits_public_ro;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM habits_public_ro;
REVOKE ALL ON SCHEMA public FROM habits_public_ro;

GRANT USAGE  ON SCHEMA public TO habits_public_ro;
GRANT SELECT ON v_insights_public TO habits_public_ro;

-- Future tables must not become readable by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM habits_public_ro;
