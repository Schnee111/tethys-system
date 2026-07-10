-- TETHYS Phase 5: Data Lifecycle Management
-- Retention policies, compression, and continuous aggregates

-- ============================================
-- RETENTION POLICIES
-- ============================================

-- High-frequency data: keep 6 months + 7 days buffer
SELECT add_retention_policy('goes_flux', INTERVAL '6 months 7 days');
SELECT add_retention_policy('solar_wind', INTERVAL '6 months 7 days');

-- Medium-frequency data: keep 1 year + 7 days buffer
SELECT add_retention_policy('atmospheric_data', INTERVAL '1 year 7 days');

-- Analysis results: keep 1 year
SELECT add_retention_policy('anomalies', INTERVAL '1 year');
SELECT add_retention_policy('correlations', INTERVAL '2 years');
SELECT add_retention_policy('narratives', INTERVAL '1 year');

-- Low-volume, high-value data: keep all (no policy)
-- seismic_events, volcanic_events, space_weather_events

-- ============================================
-- COMPRESSION POLICIES
-- ============================================

-- Enable compression for high-frequency tables
ALTER TABLE goes_flux SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'flux_type, energy_band',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('goes_flux', INTERVAL '7 days');

ALTER TABLE solar_wind SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'source',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('solar_wind', INTERVAL '7 days');

ALTER TABLE atmospheric_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'location_name',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('atmospheric_data', INTERVAL '7 days');

-- Compress analysis results
ALTER TABLE anomalies SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'domain, severity',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('anomalies', INTERVAL '7 days');

-- ============================================
-- CONTINUOUS AGGREGATES (Downsampling)
-- ============================================

-- GOES Flux: 1-minute → hourly averages
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

SELECT add_continuous_aggregate_policy('goes_flux_hourly',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

-- Solar Wind: 5-minute → hourly averages
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

SELECT add_continuous_aggregate_policy('solar_wind_hourly',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

-- Atmospheric: hourly → daily averages
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

SELECT add_continuous_aggregate_policy('atmospheric_daily',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day'
);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check retention policies
SELECT application_name, schedule_interval, config 
FROM timescaledb_information.jobs 
WHERE application_name LIKE '%retention%';

-- Check compression policies
SELECT application_name, schedule_interval, config 
FROM timescaledb_information.jobs 
WHERE application_name LIKE '%compress%';

-- Check continuous aggregates
SELECT view_name, materialization_hypertable_name 
FROM timescaledb_information.continuous_aggregates;

-- Check storage savings
SELECT 
    hypertable_name,
    pg_size_pretty(hypertable_size(format('%I.%I', hypertable_schema, hypertable_name)::regclass)) as total_size,
    pg_size_pretty(hypertable_size(format('%I.%I', hypertable_schema, hypertable_name)::regclass, true)) as compressed_size
FROM timescaledb_information.hypertables
ORDER BY hypertable_size(format('%I.%I', hypertable_schema, hypertable_name)::regclass) DESC;
