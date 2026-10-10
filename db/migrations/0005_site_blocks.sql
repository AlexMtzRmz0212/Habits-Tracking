-- ===========================================================================
-- 0005_site_blocks.sql — the website's story, and habits that outlive the app.
--
-- Two ideas:
--
--   1. LIFECYCLE. A habit you delete in Loop vanishes from the next backup.
--      The sync only ever upserts, so its row and entries already survive --
--      but nothing recorded THAT it vanished, or when. habit_events is that
--      record: first seen, archived, unarchived, removed from the app,
--      restored. Dates are the day the sync noticed, not the day you tapped
--      the button in Loop.
--
--   2. SITE BLOCKS. Everything the website can show is one row here: a habit
--      story or a headline stat. A row holds a frozen snapshot (`payload`)
--      plus the words you wrote (`title`, `body`), so it keeps rendering even
--      if the habit it came from is later deleted -- habit_id is SET NULL,
--      never CASCADE. The pipeline owns `payload`; you own `title`, `body`
--      and `is_public`. Same rule as insights: a re-run never changes what
--      you decided.
-- ===========================================================================

ALTER TABLE habits ADD COLUMN IF NOT EXISTS last_seen_at        TIMESTAMPTZ;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS removed_from_app_at TIMESTAMPTZ;

-- Habits that exist today were, by definition, last seen on their last sync.
UPDATE habits SET last_seen_at = updated_at WHERE last_seen_at IS NULL;

CREATE TABLE IF NOT EXISTS habit_events (
    id          BIGSERIAL PRIMARY KEY,
    -- RESTRICT: a habit with a history cannot be deleted by accident.
    habit_id    INTEGER NOT NULL REFERENCES habits(id) ON DELETE RESTRICT,
    event       TEXT    NOT NULL CHECK (event IN (
                    'first_seen', 'archived', 'unarchived',
                    'removed_from_app', 'restored_to_app')),
    occurred_on DATE    NOT NULL DEFAULT current_date,
    sync_run_id INTEGER REFERENCES sync_runs(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS habit_events_habit_idx
    ON habit_events (habit_id, occurred_on);

CREATE TABLE IF NOT EXISTS site_blocks (
    id         SERIAL PRIMARY KEY,
    kind       TEXT NOT NULL CHECK (kind IN ('habit_story', 'stat')),
    slug       TEXT NOT NULL UNIQUE,
    -- SET NULL, not CASCADE: the story must survive the habit being deleted.
    habit_id   INTEGER REFERENCES habits(id) ON DELETE SET NULL,
    -- Public wording. Seeded from the habit name once, then yours to edit.
    title      TEXT NOT NULL,
    -- Your note: the "why". Empty until you write one.
    body       TEXT NOT NULL DEFAULT '',
    -- Snapshot of the facts: dates, counts, how it worked, lifecycle events.
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_date  DATE,
    is_public  BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_blocks_public_idx
    ON site_blocks (is_public, sort_date);

INSERT INTO schema_migrations (version) VALUES ('0005_site_blocks')
ON CONFLICT (version) DO NOTHING;
