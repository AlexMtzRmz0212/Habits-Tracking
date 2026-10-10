-- ===========================================================================
-- 0006_site_block_retired.sql — retire a habit by hand.
--
-- "Retired" used to mean one thing: the habit vanished from the Loop backup.
-- But you decide a habit is over before you get round to deleting it in the
-- app, and some habits you will never delete. `retired` is that decision.
--
-- Like title, body and is_public it belongs to you: the pipeline's upsert
-- never touches it.
-- ===========================================================================

ALTER TABLE site_blocks ADD COLUMN IF NOT EXISTS retired BOOLEAN NOT NULL DEFAULT false;

INSERT INTO schema_migrations (version) VALUES ('0006_site_block_retired')
ON CONFLICT (version) DO NOTHING;
