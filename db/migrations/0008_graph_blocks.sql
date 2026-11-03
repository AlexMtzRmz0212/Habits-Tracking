-- ===========================================================================
-- 0008_graph_blocks.sql — graphs and the sleep chart as site blocks.
--
-- The dashboard's Graphs and Sleep tabs used to read private tables directly,
-- so they could never be shown on the public page. Making each one a site
-- block gives it the same show/hide switch as a stat or a story: the pipeline
-- writes the chart's data into `payload`, you decide `is_public`, and the
-- existing v_site_public view carries it (no view change needed).
--
--   graph-cadence-<habit id>   weeks done and gaps between done days
--   graph-sleep                every night: hours asleep, bedtime, wake-up
--
-- Both start hidden like every block. Publishing the sleep block publishes
-- the clock times of every night, which is why it is a deliberate switch.
-- ===========================================================================

ALTER TABLE site_blocks DROP CONSTRAINT IF EXISTS site_blocks_kind_check;
ALTER TABLE site_blocks
    ADD CONSTRAINT site_blocks_kind_check
    CHECK (kind IN ('habit_story', 'stat', 'graph'));

INSERT INTO schema_migrations (version) VALUES ('0008_graph_blocks')
ON CONFLICT (version) DO NOTHING;
