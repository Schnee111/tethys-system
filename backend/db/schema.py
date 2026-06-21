"""Tethys — Database Schema.

All table definitions for Phase 1. Run create_tables() at startup
to create tables if they don't exist. TimescaleDB hypertables are
created with create_hypertable() which is idempotent.
"""

import contextlib
import logging

import asyncpg

logger = logging.getLogger(__name__)

SCHEMA_SQL = """
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ═══════════════════════════════════════════════════════════
-- PHASE 1 TABLES
-- ═══════════════════════════════════════════════════════════

-- Seismic events (USGS)
CREATE TABLE IF NOT EXISTS seismic_events (
    time          TIMESTAMPTZ NOT NULL,
    event_id      TEXT NOT NULL,
    magnitude     REAL NOT NULL,
    latitude      REAL NOT NULL,
    longitude     REAL NOT NULL,
    depth_km      REAL,
    place         TEXT,
    type          TEXT DEFAULT 'earthquake',
    tsunami       INTEGER DEFAULT 0,
    sig           INTEGER,
    alert         TEXT,
    felt          INTEGER,
    cdi           REAL,
    mmi           REAL,
    mag_type      TEXT,
    net           TEXT,
    raw_data      JSONB,
    PRIMARY KEY (time, event_id)
);

-- Solar wind (NOAA SWPC DSCOVR)
CREATE TABLE IF NOT EXISTS solar_wind (
    time          TIMESTAMPTZ NOT NULL,
    source        TEXT DEFAULT 'dscovr',
    density       REAL,
    speed         REAL,
    temperature   REAL,
    bt            REAL,
    bx_gsm        REAL,
    by_gsm        REAL,
    bz_gsm        REAL,
    lon_gsm       REAL,
    lat_gsm       REAL,
    PRIMARY KEY (time, source)
);

-- GOES X-ray / proton / electron flux
CREATE TABLE IF NOT EXISTS goes_flux (
    time          TIMESTAMPTZ NOT NULL,
    flux_type     TEXT NOT NULL,
    energy_band   TEXT NOT NULL,
    flux          REAL NOT NULL,
    satellite     TEXT NOT NULL DEFAULT 'goes-primary',
    PRIMARY KEY (time, flux_type, energy_band, satellite)
);

-- Space weather events (NASA DONKI)
CREATE TABLE IF NOT EXISTS space_weather_events (
    time          TIMESTAMPTZ NOT NULL,
    event_id      TEXT NOT NULL,
    event_type    TEXT NOT NULL,
    source        TEXT,
    speed         REAL,
    latitude      REAL,
    longitude     REAL,
    description   TEXT,
    link          TEXT,
    raw_data      JSONB,
    PRIMARY KEY (time, event_id)
);

-- Atmospheric data (Open-Meteo)
CREATE TABLE IF NOT EXISTS atmospheric_data (
    time          TIMESTAMPTZ NOT NULL,
    location_name TEXT NOT NULL,
    latitude      REAL NOT NULL,
    longitude     REAL NOT NULL,
    category      TEXT NOT NULL,
    temperature   REAL,
    temp_min      REAL,
    precipitation REAL,
    wind_speed    REAL,
    wind_dir      REAL,
    PRIMARY KEY (time, location_name)
);

-- Volcanic events (NASA EONET)
CREATE TABLE IF NOT EXISTS volcanic_events (
    time          TIMESTAMPTZ NOT NULL,
    event_id      TEXT NOT NULL,
    volcano_name  TEXT NOT NULL,
    latitude      REAL NOT NULL,
    longitude     REAL NOT NULL,
    elevation_m   REAL,
    event_type    TEXT,
    vei           REAL,
    description   TEXT,
    link          TEXT,
    raw_data      JSONB,
    PRIMARY KEY (time, event_id)
);

-- Collector health status
CREATE TABLE IF NOT EXISTS collector_status (
    time          TIMESTAMPTZ NOT NULL,
    collector     TEXT NOT NULL,
    status        TEXT NOT NULL,
    records_count INTEGER DEFAULT 0,
    latency_ms    REAL,
    error_message TEXT,
    PRIMARY KEY (time, collector)
);

-- Raw ingestion (event sourcing)
CREATE TABLE IF NOT EXISTS raw_ingestion (
    time          TIMESTAMPTZ NOT NULL,
    source        TEXT NOT NULL,
    endpoint      TEXT NOT NULL,
    response_code INTEGER,
    response_body JSONB NOT NULL,
    record_count  INTEGER,
    parse_status  TEXT DEFAULT 'ok',
    parse_error   TEXT,
    PRIMARY KEY (time, source, endpoint)
);

-- ═══════════════════════════════════════════════════════════
-- PHASE 2 TABLES — Intelligence Engine
-- ═══════════════════════════════════════════════════════════

-- Anomaly detection results
CREATE TABLE IF NOT EXISTS anomalies (
    time          TIMESTAMPTZ NOT NULL,
    anomaly_id    TEXT NOT NULL,
    domain        TEXT NOT NULL,
    metric        TEXT NOT NULL,
    value         REAL NOT NULL,
    z_score       REAL,
    threshold     REAL,
    severity      TEXT NOT NULL,
    description   TEXT,
    raw_data      JSONB,
    PRIMARY KEY (time, anomaly_id)
);

-- Cross-domain correlation results
CREATE TABLE IF NOT EXISTS correlations (
    time              TIMESTAMPTZ NOT NULL,
    correlation_id    TEXT NOT NULL,
    domain_a          TEXT NOT NULL,
    metric_a          TEXT NOT NULL,
    domain_b          TEXT NOT NULL,
    metric_b          TEXT NOT NULL,
    window_hours      INTEGER NOT NULL,
    lag_hours         INTEGER DEFAULT 0,
    pearson_r         REAL,
    spearman_rho      REAL,
    p_value           REAL,
    p_value_corrected REAL,
    fdr_method        TEXT,
    sample_size       INTEGER,
    is_significant    BOOLEAN,
    description       TEXT,
    PRIMARY KEY (time, correlation_id)
);

-- Composite activity assessments
CREATE TABLE IF NOT EXISTS activity_assessments (
    time              TIMESTAMPTZ NOT NULL,
    assessment_id     TEXT NOT NULL,
    activity_level    TEXT NOT NULL,
    activity_score    REAL NOT NULL,
    confidence        REAL,
    coverage          TEXT,
    score_breakdown   JSONB,
    active_anomalies  INTEGER,
    active_correlations INTEGER,
    domains_affected  TEXT[],
    summary           TEXT,
    details           JSONB,
    PRIMARY KEY (time, assessment_id)
);
"""

HYPERTABLES_SQL = """
-- Create hypertables (idempotent — skip if already exists)
SELECT create_hypertable('seismic_events', 'time', if_not_exists => TRUE);
SELECT create_hypertable('solar_wind', 'time', if_not_exists => TRUE);
SELECT create_hypertable('goes_flux', 'time', if_not_exists => TRUE);
SELECT create_hypertable('space_weather_events', 'time', if_not_exists => TRUE);
SELECT create_hypertable('atmospheric_data', 'time', if_not_exists => TRUE);
SELECT create_hypertable('volcanic_events', 'time', if_not_exists => TRUE);
SELECT create_hypertable('collector_status', 'time', if_not_exists => TRUE);
SELECT create_hypertable('raw_ingestion', 'time', if_not_exists => TRUE);
SELECT create_hypertable('anomalies', 'time', if_not_exists => TRUE);
SELECT create_hypertable('correlations', 'time', if_not_exists => TRUE);
SELECT create_hypertable('activity_assessments', 'time', if_not_exists => TRUE);
"""

INDEXES_SQL = """
-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_seismic_magnitude ON seismic_events (magnitude DESC);
CREATE INDEX IF NOT EXISTS idx_seismic_location ON seismic_events (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_solar_wind_source ON solar_wind (source, time DESC);
CREATE INDEX IF NOT EXISTS idx_goes_flux_type ON goes_flux (flux_type, time DESC);
CREATE INDEX IF NOT EXISTS idx_space_weather_type ON space_weather_events (event_type, time DESC);
CREATE INDEX IF NOT EXISTS idx_atmospheric_location ON atmospheric_data (location_name, time DESC);
CREATE INDEX IF NOT EXISTS idx_atmospheric_category ON atmospheric_data (category, time DESC);
CREATE INDEX IF NOT EXISTS idx_atmospheric_coords ON atmospheric_data (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_anomalies_domain ON anomalies (domain, time DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies (severity, time DESC);
CREATE INDEX IF NOT EXISTS idx_correlations_significant ON correlations (is_significant, time DESC);
"""

CONTINUOUS_AGGREGATES_SQL = """
-- Continuous aggregates for high-frequency data
-- These MUST exist in Phase 1 because Phase 2 CorrelationEngine queries them.

CREATE MATERIALIZED VIEW IF NOT EXISTS goes_flux_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hour,
    flux_type,
    energy_band,
    satellite,
    AVG(flux) AS avg_flux,
    MAX(flux) AS max_flux,
    MIN(flux) AS min_flux,
    COUNT(*) AS sample_count
FROM goes_flux
GROUP BY hour, flux_type, energy_band, satellite;

CREATE MATERIALIZED VIEW IF NOT EXISTS solar_wind_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hour,
    source,
    AVG(density) AS avg_density,
    AVG(speed) AS avg_speed,
    AVG(temperature) AS avg_temperature,
    AVG(bt) AS avg_bt,
    AVG(bz_gsm) AS avg_bz_gsm,
    MAX(speed) AS max_speed,
    COUNT(*) AS sample_count
FROM solar_wind
GROUP BY hour, source;

CREATE MATERIALIZED VIEW IF NOT EXISTS atmospheric_daily
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS day,
    location_name,
    category,
    AVG(temperature) AS avg_temp,
    MAX(temperature) AS max_temp,
    MIN(temperature) AS min_temp,
    AVG(wind_speed) AS avg_wind,
    SUM(precipitation) AS total_precip
FROM atmospheric_data
GROUP BY day, location_name, category;
"""

REFRESH_POLICIES_SQL = """
-- Refresh policies for continuous aggregates
-- start_offset: how far back to look for changes
-- end_offset: how recent to process (1 hour = near real-time)
-- schedule_interval: how often to refresh

SELECT add_continuous_aggregate_policy('goes_flux_hourly',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('solar_wind_hourly',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('atmospheric_daily',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE);
"""


async def create_tables(pool: asyncpg.Pool) -> None:
    """Create all tables, hypertables, indexes, and continuous aggregates.

    Idempotent — safe to call on every startup.
    """
    async with pool.acquire() as conn:
        # Tables
        await conn.execute(SCHEMA_SQL)

        # Hypertables
        for stmt in HYPERTABLES_SQL.strip().split("\n"):
            stmt = stmt.strip()
            if stmt and not stmt.startswith("--"):
                with contextlib.suppress(Exception):
                    await conn.execute(stmt)

        # Indexes
        await conn.execute(INDEXES_SQL)

        # Continuous aggregates
        for stmt in CONTINUOUS_AGGREGATES_SQL.split(";"):
            stmt = stmt.strip()
            if stmt and not stmt.startswith("--"):
                with contextlib.suppress(Exception):
                    await conn.execute(stmt + ";")

        # Refresh policies
        for stmt in REFRESH_POLICIES_SQL.split(";"):
            stmt = stmt.strip()
            if stmt and not stmt.startswith("--"):
                with contextlib.suppress(Exception):
                    await conn.execute(stmt + ";")
