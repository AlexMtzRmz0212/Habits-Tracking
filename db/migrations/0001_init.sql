-- ===========================================================================
-- 0001_init.sql — core schema for Habits-Tracking
--
-- HOW LOOP HABITS ENCODES ITS DATA (verified against a real backup, 150 habits
-- / 20,238 repetitions). This is easy to get wrong, so it is written down here
-- rather than rediscovered later:
--
--   Habits.type      0 = boolean ("did you do it?"), 1 = numerical ("how much?")
--   Habits.target_type  0 = at-least, 1 = at-most
--
--   Repetitions.value for BOOLEAN habits is a status code:
--       2 = yes (entered manually)   1 = yes (auto)
--       0 = no                       3 = skip        -1 = unknown / not tracked
--
--   Repetitions.value for NUMERICAL habits is the real value MULTIPLIED BY 1000.
--       6000 -> 6.0   (a "/10" energy rating)
--       1000 -> 1     (a "times" count)
--
--   Habits whose unit is 'HH:MM' encode a CLOCK TIME in that decimal:
--       2450 -> 2.45 -> 02:45     4450 -> 4.45 -> 04:45     300 -> 0.30 -> 00:30
--   i.e. the integer part is the hour and the fractional part is the minutes.
--   Units seen in practice: seconds, minutes, HH:MM, MM:SS, times, reps, /10.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Curated grouping. Loop Habits has no notion of categories or of public vs
-- private, so both are introduced here and maintained by scripts/tag_habits.py.
-- ---------------------------------------------------------------------------
CREATE TABLE habit_categories (
    id   SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL
);

CREATE TABLE habits (
    -- loop_uuid is the natural key: Loop's own integer id is local to a device
    -- and is NOT stable across re-exports, so upserts must key on the uuid.
    id           SERIAL PRIMARY KEY,
    loop_uuid    TEXT UNIQUE NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    question     TEXT,
    unit         TEXT,
    value_type   TEXT NOT NULL CHECK (value_type IN ('boolean', 'numerical')),
    target_type  TEXT CHECK (target_type IN ('at_least', 'at_most')),
    target_value NUMERIC,
    freq_num     INT,
    freq_den     INT,
    color        INT,
    position     INT,
    archived     BOOLEAN NOT NULL DEFAULT false,

    category_id  INT REFERENCES habit_categories(id) ON DELETE SET NULL,

    -- Defaults to FALSE so a newly-synced habit is private until explicitly
    -- published. A habit must never become public by accident.
    is_public    BOOLEAN NOT NULL DEFAULT false,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX habits_is_public_idx ON habits (is_public);
CREATE INDEX habits_category_idx  ON habits (category_id);

-- ---------------------------------------------------------------------------
-- One row per habit per day.
--   raw_value  keeps exactly what Loop stored, so a decoding bug is always
--              recoverable without re-importing the backup.
--   value      is the decoded real number (raw / 1000 for numerical habits).
--   status     carries boolean semantics so SQL can read naturally
--              (WHERE status = 'yes') instead of memorising magic numbers.
-- ---------------------------------------------------------------------------
CREATE TABLE repetitions (
    id           BIGSERIAL PRIMARY KEY,
    habit_id     INT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    entry_date   DATE NOT NULL,
    timestamp_ms BIGINT NOT NULL,
    raw_value    BIGINT,
    value        NUMERIC,
    status       TEXT CHECK (status IN ('yes', 'no', 'skip', 'unknown')),
    notes        TEXT,
    UNIQUE (habit_id, entry_date)          -- upsert target
);

CREATE INDEX repetitions_date_idx     ON repetitions (entry_date);
CREATE INDEX repetitions_habit_date_idx ON repetitions (habit_id, entry_date DESC);

-- Loop's own computed 0..1 rolling strength score. Cheap to display, and it
-- saves recomputing Loop's scoring algorithm just to draw a familiar chart.
CREATE TABLE scores (
    habit_id   INT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    score      NUMERIC(4,3) CHECK (score BETWEEN 0 AND 1),
    PRIMARY KEY (habit_id, entry_date)
);

-- Cross-habit values derived by the pipeline (sleep duration, time awake, ...).
-- Generic key/value rather than one column per metric, so adding a metric is a
-- pipeline change and never a migration.
CREATE TABLE derived_metrics (
    id         BIGSERIAL PRIMARY KEY,
    metric_key TEXT NOT NULL,
    entry_date DATE NOT NULL,
    value      NUMERIC,
    unit       TEXT,
    UNIQUE (metric_key, entry_date)
);

CREATE INDEX derived_metrics_key_idx ON derived_metrics (metric_key, entry_date DESC);

-- ---------------------------------------------------------------------------
-- Precomputed analytics / ML output / narrative text. The web app only ever
-- reads from here: it must never run pandas or scikit-learn on a page request.
-- ---------------------------------------------------------------------------
CREATE TABLE insights (
    id           BIGSERIAL PRIMARY KEY,
    habit_id     INT REFERENCES habits(id) ON DELETE CASCADE,   -- NULL = global
    scope        TEXT NOT NULL CHECK (scope IN ('habit', 'category', 'global')),
    kind         TEXT NOT NULL CHECK (kind IN ('streak', 'trend', 'correlation', 'anomaly', 'prediction')),
    title        TEXT NOT NULL,
    narrative    TEXT NOT NULL,
    sql_example  TEXT,              -- shown on public pages as portfolio content
    metrics      JSONB NOT NULL,    -- chart-ready payload

    -- Computed by the pipeline as the AND of every habit this insight draws on.
    -- The app never derives this itself, so a cross-habit insight touching one
    -- private habit can never surface publicly.
    is_public    BOOLEAN NOT NULL DEFAULT false,

    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX insights_public_idx ON insights (is_public, scope, kind);
CREATE INDEX insights_habit_idx  ON insights (habit_id);

-- Operational log. Also powers change detection: the sync job compares Drive
-- file metadata against the last run and skips the whole pipeline if unchanged.
CREATE TABLE sync_runs (
    id                   BIGSERIAL PRIMARY KEY,
    started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at          TIMESTAMPTZ,
    status               TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped_no_change')),
    source_file_name     TEXT,
    source_modified_time TIMESTAMPTZ,
    source_md5           TEXT,
    rows_upserted        INT,
    error_message        TEXT
);

CREATE INDEX sync_runs_started_idx ON sync_runs (started_at DESC);

INSERT INTO schema_migrations (version) VALUES ('0001_init')
ON CONFLICT (version) DO NOTHING;
