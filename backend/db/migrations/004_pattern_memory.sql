-- TETHYS Phase 4: Pattern Memory + Lament Detector tables
-- Run: docker exec tethys-db-prod psql -U tethys -d tethys -f /dev/stdin

-- pattern_catalog: stores unique pattern signatures (NOT hypertable)
-- Used for ON CONFLICT DO UPDATE to increment occurrence_count
CREATE TABLE IF NOT EXISTS pattern_catalog (
    pattern_id        TEXT PRIMARY KEY,
    pattern_type      TEXT NOT NULL,
    domains_involved  TEXT[] NOT NULL,
    metrics_involved  TEXT[] NOT NULL,
    binned_signature  JSONB NOT NULL,
    description       TEXT,
    first_seen        TIMESTAMPTZ NOT NULL,
    last_seen         TIMESTAMPTZ NOT NULL,
    occurrence_count  INTEGER DEFAULT 1,
    avg_recurrence_interval_hours REAL,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pattern_catalog_type ON pattern_catalog (pattern_type);
CREATE INDEX IF NOT EXISTS idx_pattern_catalog_domains ON pattern_catalog (domains_involved);

-- pattern_events: append-only occurrence log (IS hypertable)
CREATE TABLE IF NOT EXISTS pattern_events (
    time              TIMESTAMPTZ NOT NULL,
    pattern_id        TEXT NOT NULL,
    activity_score    REAL,
    domains_active    TEXT[],
    raw_snapshot      JSONB,
    PRIMARY KEY (time, pattern_id)
);

SELECT create_hypertable('pattern_events', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_pattern_events_id_time ON pattern_events (pattern_id, time DESC);
