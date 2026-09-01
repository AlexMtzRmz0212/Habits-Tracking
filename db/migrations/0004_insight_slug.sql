-- ===========================================================================
-- 0004_insight_slug.sql — give each analysis a stable identity.
--
-- The analytics job re-runs weekly and recomputes every analysis. Without a
-- stable key the only options are "insert duplicates" or "delete and
-- reinsert" -- and the second would wipe is_public every run, silently
-- unpublishing the portfolio.
--
-- A slug fixes that: re-running upserts on the slug, refreshing the numbers
-- and the narrative while leaving the publishing decision alone. Same rule as
-- the habit sync -- recomputed facts are the pipeline's, curation is yours.
-- ===========================================================================

ALTER TABLE insights ADD COLUMN IF NOT EXISTS slug TEXT;

-- Existing rows (if any) get a slug derived from their id so the constraint
-- can be applied without losing them.
UPDATE insights SET slug = 'legacy-' || id WHERE slug IS NULL;

ALTER TABLE insights ALTER COLUMN slug SET NOT NULL;
ALTER TABLE insights ADD CONSTRAINT insights_slug_key UNIQUE (slug);

INSERT INTO schema_migrations (version) VALUES ('0004_insight_slug')
ON CONFLICT (version) DO NOTHING;
