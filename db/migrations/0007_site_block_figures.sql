-- ===========================================================================
-- 0007_site_block_figures.sql — charts and stat rows inside a story.
--
-- A story used to be words only. `figures` holds the numbers and charts that
-- sit between its paragraphs: a JSON list of {id, type, ...}. The body places
-- one by writing `[[id]]` as a paragraph of its own.
--
-- Like title, body, is_public and retired it belongs to you: the pipeline's
-- upsert never touches it, so a re-run cannot wipe a chart. (That is why the
-- figures are not stored in `payload`, which is rewritten on every run.)
--
-- Figures are small precomputed aggregates -- a count, a monthly rate, a
-- distribution -- never raw entries, the same kind of thing an insight
-- publishes. They reach the public site through v_site_public, so the view
-- gains the column; a column added at the end is the one change
-- CREATE OR REPLACE VIEW allows, and its existing grant is kept.
-- ===========================================================================

ALTER TABLE site_blocks ADD COLUMN IF NOT EXISTS figures JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE VIEW v_site_public AS
SELECT id,
       kind,
       title,
       body,
       payload,
       sort_date,
       retired,
       figures
FROM site_blocks
WHERE is_public;

INSERT INTO schema_migrations (version) VALUES ('0007_site_block_figures')
ON CONFLICT (version) DO NOTHING;
