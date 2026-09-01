-- ===========================================================================
-- 0003_publish_at_analysis_level.sql
--
-- Corrects the model. 0001 and 0002 assumed individual habits (and later
-- individual derived metrics) could be published. That was wrong.
--
-- The real rule: habit data is ALWAYS private. It lives here and is never
-- served to the public. What gets published is an ANALYSIS -- a chart, a
-- statistic, a piece of narrative -- computed from that data.
--
-- So `insights.is_public` becomes the only publishing decision in the system,
-- and the public database role loses access to habits and repetitions
-- entirely. Not filtered views over them: no access at all. A public page
-- cannot leak raw habit data because the connection rendering it cannot see
-- the tables that hold it.
-- ===========================================================================

-- Habit-level publishing and categorisation: both concepts retired.
ALTER TABLE habits DROP COLUMN IF EXISTS is_public;
ALTER TABLE habits DROP COLUMN IF EXISTS category_id;

-- metric_catalog stays, but purely as a registry of what derived metrics
-- exist (so derived_metrics.metric_key has something to reference). It no
-- longer decides visibility -- an insight does.
ALTER TABLE metric_catalog DROP COLUMN IF EXISTS is_public;
ALTER TABLE metric_catalog DROP COLUMN IF EXISTS category_id;

DROP TABLE IF EXISTS habit_categories;

-- Views from the old model. The replacements live in db/roles.sql.
DROP VIEW IF EXISTS v_habits_public;
DROP VIEW IF EXISTS v_repetitions_public;
DROP VIEW IF EXISTS v_scores_public;
DROP VIEW IF EXISTS v_categories_public;
DROP VIEW IF EXISTS v_metric_catalog_public;
DROP VIEW IF EXISTS v_derived_metrics_public;

INSERT INTO schema_migrations (version) VALUES ('0003_publish_at_analysis_level')
ON CONFLICT (version) DO NOTHING;
