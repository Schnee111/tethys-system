# TETHYS — Phase 1 Technical Specification

## Overview

Phase 1 builds the data foundation: collectors that poll free APIs every few minutes, a time-series database to store everything, and a REST API to query the data. This is the nervous system of Tethys — everything else builds on top of it.

**Duration:** 3 weeks (matches PROJECT.md Phase 1: Week 1-3)
**Goal:** Real-time data flowing from 6 sources into TimescaleDB, queryable via API

---

## Project Structure

```
tethys/
├── backend/
│   ├── collectors/           # Data collection modules
│   │   ├── __init__.py
│   │   ├── base.py           # Base collector class
│   │   ├── seismic.py        # USGS earthquake data
│   │   ├── solar_wind.py     # NOAA SWPC solar wind
│   │   ├── goes_flux.py      # GOES X-ray/proton flux
│   │   ├── donki.py          # NASA DONKI events
│   │   ├── atmospheric.py    # Open-Meteo weather
│   │   └── volcanic.py       # NASA EONET
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI app
│   │   ├── routes/
│   │   │   ├── events.py     # Event queries
│   │   │   ├── status.py     # System health
│   │   │   └── websocket.py  # Real-time stream
│   │   └── models.py         # Pydantic models
│   ├── db/
│   │   ├── __init__.py
│   │   ├── connection.py     # Database connection pool
│   │   ├── schema.py         # Table definitions
│   │   └── migrations.py     # Schema migrations
│   ├── config.py             # Configuration
│   ├── scheduler.py          # Collector scheduling
│   ├── requirements.txt
│   └── main.py               # Entry point
├── frontend/                 # Phase 3
├── ml/                       # Phase 2
├── docs/
│   ├── PROJECT.md
│   └── PHASE1-SPEC.md        # This file
├── docker-compose.yml        # Optional: local dev
└── README.md
```

### Database Connection Pool (CRITICAL)

```python
# db/connection.py
# Connection pool limits prevent PostgreSQL OOM on 4GB VPS.
# With 6 collectors + 2 Uvicorn workers + analysis scheduler,
# unbounded connections could exhaust PostgreSQL's max_connections (100)
# and cause memory pressure.
#
# Source: Gemini Review — "Connection Starvation on TimescaleDB"

import asyncpg

_pool: asyncpg.Pool = None

async def init_pool(database_url: str) -> asyncpg.Pool:
    global _pool
    _pool = await asyncpg.create_pool(
        database_url,
        min_size=2,      # Minimum idle connections
        max_size=15,     # Maximum total connections
        # 6 collectors + 2 Uvicorn workers + analysis = ~10 concurrent
        # 15 gives headroom without exhausting PostgreSQL
        command_timeout=30,  # Query timeout in seconds
    )
    return _pool

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_pool() first.")
    return _pool

async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
```

---

## Database Schema

### TimescaleDB Setup

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create hypertables for time-series data
```

### Table: seismic_events

```sql
CREATE TABLE seismic_events (
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
    raw_data      JSONB,         -- full API response (future-proofing)
    PRIMARY KEY (time, event_id)
);

SELECT create_hypertable('seismic_events', 'time');
CREATE INDEX ON seismic_events (magnitude DESC);
CREATE INDEX ON seismic_events (latitude, longitude);
```

### Table: solar_wind

```sql
CREATE TABLE solar_wind (
    time          TIMESTAMPTZ NOT NULL,
    source        TEXT DEFAULT 'dscovr',  -- 'dscovr' or 'ace'
    density       REAL,        -- protons/cm³ (from plasma file)
    speed         REAL,        -- km/s (from plasma file)
    temperature   REAL,        -- K (from plasma file)
    bt            REAL,        -- total magnetic field nT (from mag file)
    bx_gsm        REAL,        -- magnetic field x-component (from mag file)
    by_gsm        REAL,        -- magnetic field y-component (from mag file)
    bz_gsm        REAL,        -- magnetic field z-component (from mag file)
    lon_gsm       REAL,
    lat_gsm       REAL,
    PRIMARY KEY (time, source)
);

SELECT create_hypertable('solar_wind', 'time');

-- NOTE: Plasma & Magnetometer arrive from SEPARATE NOAA files.
-- Use ON CONFLICT DO UPDATE with COALESCE to merge, not discard.
-- Example upsert:
-- INSERT INTO solar_wind (time, source, density, speed, temperature)
-- VALUES ($1, 'dscovr', $2, $3, $4)
-- ON CONFLICT (time, source) DO UPDATE SET
--   density = COALESCE(EXCLUDED.density, solar_wind.density),
--   speed = COALESCE(EXCLUDED.speed, solar_wind.speed),
--   temperature = COALESCE(EXCLUDED.temperature, solar_wind.temperature);
```

### Table: goes_flux

```sql
CREATE TABLE goes_flux (
    time          TIMESTAMPTZ NOT NULL,
    flux_type     TEXT NOT NULL,  -- 'xray', 'proton', 'electron'
    energy_band   TEXT NOT NULL,  -- '1-8A', '0.5-4A', '>=10MeV', etc.
    flux          REAL NOT NULL,
    satellite     TEXT NOT NULL DEFAULT 'goes-primary',
    PRIMARY KEY (time, flux_type, energy_band, satellite)
);

SELECT create_hypertable('goes_flux', 'time');
CREATE INDEX ON goes_flux (flux_type, time DESC);
```

### Table: space_weather_events

```sql
CREATE TABLE space_weather_events (
    time          TIMESTAMPTZ NOT NULL,
    event_id      TEXT NOT NULL,
    event_type    TEXT NOT NULL,  -- 'CME', 'GST', 'FLR', 'IPS', 'SEP', 'HSS'
    source        TEXT,           -- solar source location
    speed         REAL,           -- km/s (for CMEs)
    latitude      REAL,
    longitude     REAL,
    description   TEXT,
    link          TEXT,
    raw_data      JSONB,
    PRIMARY KEY (time, event_id)
);

SELECT create_hypertable('space_weather_events', 'time');
CREATE INDEX ON space_weather_events (event_type, time DESC);
```

### Table: atmospheric_data

```sql
CREATE TABLE atmospheric_data (
    time          TIMESTAMPTZ NOT NULL,
    location_name TEXT NOT NULL,   -- 'Tokyo', 'North_Pacific_Station_3', etc.
    latitude      REAL NOT NULL,
    longitude     REAL NOT NULL,
    category      TEXT NOT NULL,   -- 'city', 'ocean', 'polar', 'tectonic', 'extreme'
    temperature   REAL,        -- °C daily max
    temp_min      REAL,        -- °C daily min
    precipitation REAL,        -- mm daily total
    wind_speed    REAL,        -- km/h daily max
    wind_dir      REAL,        -- degrees dominant direction
    PRIMARY KEY (time, location_name)
);

SELECT create_hypertable('atmospheric_data', 'time');
CREATE INDEX ON atmospheric_data (location_name, time DESC);
CREATE INDEX ON atmospheric_data (category, time DESC);
CREATE INDEX ON atmospheric_data (latitude, longitude);

-- 150 points × 4 polls/day × 182 days = 109K rows for 6 months (~11 MB)
```

### 150 Strategic Points List

```python
ATMOSPHERIC_POINTS = [
    # ═══════════════════════════════════════════════════════════
    # MAJOR CITIES (80 points) — by continent
    # ═══════════════════════════════════════════════════════════
    
    # Asia (25)
    ("Tokyo", 35.68, 139.69, "city"),
    ("Shanghai", 31.23, 121.47, "city"),
    ("Beijing", 39.90, 116.40, "city"),
    ("Delhi", 28.61, 77.21, "city"),
    ("Mumbai", 19.08, 72.88, "city"),
    ("Jakarta", -6.21, 106.85, "city"),
    ("Bangkok", 13.76, 100.50, "city"),
    ("Seoul", 37.57, 126.98, "city"),
    ("Manila", 14.60, 120.98, "city"),
    ("Singapore", 1.35, 103.82, "city"),
    ("Kuala Lumpur", 3.14, 101.69, "city"),
    ("Hanoi", 21.03, 105.85, "city"),
    ("Dhaka", 23.81, 90.41, "city"),
    ("Karachi", 24.86, 67.01, "city"),
    ("Tehran", 35.69, 51.39, "city"),
    ("Baghdad", 33.31, 44.37, "city"),
    ("Riyadh", 24.71, 46.68, "city"),
    ("Istanbul", 41.01, 28.98, "city"),
    ("Taipei", 25.03, 121.57, "city"),
    ("Kolkata", 22.57, 88.36, "city"),
    ("Chennai", 13.08, 80.27, "city"),
    ("Chengdu", 30.57, 104.07, "city"),
    ("Shenzhen", 22.54, 114.06, "city"),
    ("Ho_Chi_Minh", 10.82, 106.63, "city"),
    ("Osaka", 34.69, 135.50, "city"),
    
    # Europe (15)
    ("London", 51.51, -0.13, "city"),
    ("Paris", 48.86, 2.35, "city"),
    ("Berlin", 52.52, 13.41, "city"),
    ("Madrid", 40.42, -3.70, "city"),
    ("Rome", 41.90, 12.50, "city"),
    ("Moscow", 55.76, 37.62, "city"),
    ("Stockholm", 59.33, 18.07, "city"),
    ("Warsaw", 52.23, 21.01, "city"),
    ("Bucharest", 44.43, 26.10, "city"),
    ("Athens", 37.98, 23.73, "city"),
    ("Lisbon", 38.72, -9.14, "city"),
    ("Amsterdam", 52.37, 4.90, "city"),
    ("Vienna", 48.21, 16.37, "city"),
    ("Helsinki", 60.17, 24.94, "city"),
    ("Oslo", 59.91, 10.75, "city"),
    
    # North America (12)
    ("New_York", 40.71, -74.01, "city"),
    ("Los_Angeles", 34.05, -118.24, "city"),
    ("Chicago", 41.88, -87.63, "city"),
    ("Mexico_City", 19.43, -99.13, "city"),
    ("Toronto", 43.65, -79.38, "city"),
    ("Vancouver", 49.28, -123.12, "city"),
    ("Houston", 29.76, -95.37, "city"),
    ("Miami", 25.76, -80.19, "city"),
    ("Denver", 39.74, -104.99, "city"),
    ("Anchorage", 61.22, -149.90, "city"),
    ("Havana", 23.11, -82.37, "city"),
    ("Panama_City", 8.98, -79.52, "city"),
    
    # South America (10)
    ("Sao_Paulo", -23.55, -46.63, "city"),
    ("Buenos_Aires", -34.60, -58.38, "city"),
    ("Lima", -12.05, -77.04, "city"),
    ("Bogota", 4.71, -74.07, "city"),
    ("Santiago", -33.45, -70.67, "city"),
    ("Rio_de_Janeiro", -22.91, -43.17, "city"),
    ("Caracas", 10.48, -66.90, "city"),
    ("Quito", -0.18, -78.47, "city"),
    ("La_Paz", -16.50, -68.15, "city"),
    ("Montevideo", -34.90, -56.19, "city"),
    
    # Africa (10)
    ("Cairo", 30.04, 31.24, "city"),
    ("Lagos", 6.52, 3.38, "city"),
    ("Nairobi", -1.29, 36.82, "city"),
    ("Johannesburg", -26.20, 28.05, "city"),
    ("Casablanca", 33.57, -7.59, "city"),
    ("Addis_Ababa", 9.02, 38.75, "city"),
    ("Dar_es_Salaam", -6.79, 39.28, "city"),
    ("Accra", 5.56, -0.19, "city"),
    ("Kinshasa", -4.44, 15.27, "city"),
    ("Dakar", 14.72, -17.47, "city"),
    
    # Oceania (8)
    ("Sydney", -33.87, 151.21, "city"),
    ("Melbourne", -37.81, 144.96, "city"),
    ("Auckland", -36.85, 174.76, "city"),
    ("Perth", -31.95, 115.86, "city"),
    ("Brisbane", -27.47, 153.03, "city"),
    ("Wellington", -41.29, 174.78, "city"),
    ("Suva", -18.14, 178.44, "city"),
    ("Port_Moresby", -9.44, 147.18, "city"),
    
    # ═══════════════════════════════════════════════════════════
    # OCEAN STATIONS (30 points) — major currents and basins
    # ═══════════════════════════════════════════════════════════
    
    # Pacific (10)
    ("North_Pacific_1", 40.0, -170.0, "ocean"),
    ("North_Pacific_2", 35.0, -145.0, "ocean"),
    ("Equatorial_Pacific_1", 0.0, -140.0, "ocean"),
    ("Equatorial_Pacific_2", 0.0, -170.0, "ocean"),
    ("South_Pacific_1", -30.0, -130.0, "ocean"),
    ("South_Pacific_2", -40.0, -100.0, "ocean"),
    ("West_Pacific_1", 10.0, 140.0, "ocean"),
    ("West_Pacific_2", 20.0, 130.0, "ocean"),
    ("Coral_Sea", -15.0, 155.0, "ocean"),
    ("Tasman_Sea", -35.0, 160.0, "ocean"),
    
    # Atlantic (10)
    ("North_Atlantic_1", 45.0, -30.0, "ocean"),
    ("North_Atlantic_2", 35.0, -50.0, "ocean"),
    ("Equatorial_Atlantic_1", 0.0, -20.0, "ocean"),
    ("Equatorial_Atlantic_2", 5.0, -40.0, "ocean"),
    ("South_Atlantic_1", -20.0, -10.0, "ocean"),
    ("South_Atlantic_2", -35.0, -20.0, "ocean"),
    ("Gulf_Stream", 35.0, -70.0, "ocean"),
    ("Caribbean_Sea", 15.0, -75.0, "ocean"),
    ("Mediterranean", 35.0, 18.0, "ocean"),
    ("North_Sea", 55.0, 3.0, "ocean"),
    
    # Indian Ocean (5)
    ("Indian_Ocean_1", -10.0, 60.0, "ocean"),
    ("Indian_Ocean_2", -25.0, 75.0, "ocean"),
    ("Indian_Ocean_3", 0.0, 80.0, "ocean"),
    ("Arabian_Sea", 15.0, 65.0, "ocean"),
    ("Bay_of_Bengal", 15.0, 88.0, "ocean"),
    
    # Southern Ocean (5)
    ("Southern_Ocean_1", -50.0, 0.0, "ocean"),
    ("Southern_Ocean_2", -55.0, -60.0, "ocean"),
    ("Southern_Ocean_3", -50.0, 120.0, "ocean"),
    ("Drake_Passage", -60.0, -65.0, "ocean"),
    ("Ross_Sea", -70.0, 175.0, "ocean"),
    
    # ═══════════════════════════════════════════════════════════
    # POLAR STATIONS (10 points) — research stations
    # ═══════════════════════════════════════════════════════════
    
    # Arctic (5)
    ("Svalbard", 78.23, 15.63, "polar"),
    ("Barrow_Alaska", 71.29, -156.79, "polar"),
    ("Alert_Canada", 82.50, -62.35, "polar"),
    ("Tromso_Norway", 69.65, 18.96, "polar"),
    ("Murmansk_Russia", 68.97, 33.07, "polar"),
    
    # Antarctic (5)
    ("McMurdo", -77.85, 166.67, "polar"),
    ("South_Pole", -90.00, 0.00, "polar"),
    ("Halley_Antarctica", -75.58, -26.57, "polar"),
    ("Palmer_Antarctica", -64.77, -64.05, "polar"),
    ("Dome_C_Antarctica", -75.10, 123.35, "polar"),
    
    # ═══════════════════════════════════════════════════════════
    # TECTONIC BOUNDARY POINTS (20 points) — Ring of Fire + ridges
    # ═══════════════════════════════════════════════════════════
    
    # Pacific Ring of Fire (12)
    ("Cascadia_US", 46.85, -122.90, "tectonic"),
    ("San_Andreas_CA", 35.80, -121.30, "tectonic"),
    ("Mexico_Subduction", 17.50, -101.50, "tectonic"),
    ("Central_America", 12.50, -88.50, "tectonic"),
    ("Chile_Trench", -33.00, -72.00, "tectonic"),
    ("Peru_Trench", -12.00, -78.00, "tectonic"),
    ("Japan_Trench", 39.00, 143.00, "tectonic"),
    ("Mariana_Trench", 13.00, 145.00, "tectonic"),
    ("Philippines", 12.00, 124.00, "tectonic"),
    ("Indonesia_Sumatra", -2.00, 101.00, "tectonic"),
    ("New_Zealand", -41.00, 175.00, "tectonic"),
    ("Tonga_Kermadec", -25.00, -177.00, "tectonic"),
    
    # Mid-Ocean Ridges (5)
    ("Mid_Atlantic_Ridge_N", 30.00, -43.00, "tectonic"),
    ("Mid_Atlantic_Ridge_Eq", 0.00, -20.00, "tectonic"),
    ("Mid_Atlantic_Ridge_S", -30.00, -15.00, "tectonic"),
    ("East_Pacific_Rise", -15.00, -115.00, "tectonic"),
    ("Indian_Ocean_Ridge", -10.00, 65.00, "tectonic"),
    
    # Collision Zones (3)
    ("Himalaya_Nepal", 28.00, 85.00, "tectonic"),
    ("Turkey_Anatolia", 39.00, 33.00, "tectonic"),
    ("Iran_Zagros", 32.00, 51.00, "tectonic"),
    
    # ═══════════════════════════════════════════════════════════
    # EXTREME CLIMATE POINTS (10 points)
    # ═══════════════════════════════════════════════════════════
    
    ("Sahara_Desert", 23.00, 12.00, "extreme"),
    ("Gobi_Desert", 43.00, 105.00, "extreme"),
    ("Atacama_Desert", -24.00, -69.00, "extreme"),
    ("Amazon_Rainforest", -3.00, -60.00, "extreme"),
    ("Congo_Rainforest", 0.00, 25.00, "extreme"),
    ("Siberian_Tundra", 65.00, 100.00, "extreme"),
    ("Death_Valley", 36.46, -116.87, "extreme"),
    ("Cherrapunji_India", 25.30, 91.70, "extreme"),
    ("Oymyakon_Russia", 63.46, 142.78, "extreme"),
    ("Dallol_Ethiopia", 14.24, 40.30, "extreme"),
]

# Total: 80 cities + 30 ocean + 10 polar + 20 tectonic + 10 extreme = 150 points
```

### Table: volcanic_events

```sql
CREATE TABLE volcanic_events (
    time          TIMESTAMPTZ NOT NULL,
    event_id      TEXT NOT NULL,
    volcano_name  TEXT NOT NULL,
    latitude      REAL NOT NULL,
    longitude     REAL NOT NULL,
    elevation_m   REAL,
    event_type    TEXT,           -- 'eruption', 'ash', 'lava', etc.
    vei           REAL,           -- Volcanic Explosivity Index
    description   TEXT,
    link          TEXT,
    raw_data      JSONB,         -- full API response (future-proofing)
    PRIMARY KEY (time, event_id)
);

SELECT create_hypertable('volcanic_events', 'time');
```

### Table: collector_status

```sql
CREATE TABLE collector_status (
    time          TIMESTAMPTZ NOT NULL,
    collector     TEXT NOT NULL,
    status        TEXT NOT NULL,  -- 'ok', 'error', 'timeout'
    records_count INTEGER DEFAULT 0,
    latency_ms    REAL,
    error_message TEXT,
    PRIMARY KEY (time, collector)
);

SELECT create_hypertable('collector_status', 'time');
```

### Table: raw_ingestion (Event Sourcing)

```sql
-- IMMUTABLE raw API responses. First-class event sourcing architecture.
-- If NOAA/USGS changes schema, parsing breaks, historical data is lost.
-- This table stores EVERY raw response as-is. Transformation is separate.
-- If parsing breaks: re-process from raw_ingestion.
--
-- Source: GPT Engineering Review — "No event sourcing"

CREATE TABLE raw_ingestion (
    time          TIMESTAMPTZ NOT NULL,
    source        TEXT NOT NULL,      -- 'usgs', 'noaa_swpc', 'goes', 'donki', 'openmeteo', 'eonet'
    endpoint      TEXT NOT NULL,      -- API endpoint URL
    response_code INTEGER,            -- HTTP status code
    response_body JSONB NOT NULL,     -- Full raw API response
    record_count  INTEGER,            -- Number of records parsed from response
    parse_status  TEXT DEFAULT 'ok',  -- 'ok', 'parse_error', 'empty'
    parse_error   TEXT,               -- Error message if parsing failed
    PRIMARY KEY (time, source, endpoint)
);

SELECT create_hypertable('raw_ingestion', 'time');

-- Retention: keep raw for 90 days (storage cheap, debugging invaluable)
-- After 90 days, raw data is in transformed tables anyway
```

Usage in collectors:
```python
class BaseCollector:
    async def collect_and_store_raw(self, pool) -> list[dict]:
        """Fetch API response, store raw, then parse and transform.
        
        Uses RETURNING to get the inserted row's ID, avoiding race condition
        where another collector could INSERT between our INSERT and UPDATE.
        
        Source: Claude Review — "Race condition di raw_ingestion update"
        """
        async with aiohttp.ClientSession() as session:
            async with session.get(self.endpoint, timeout=self.timeout) as resp:
                raw_body = await resp.json()
                response_code = resp.status
        
        # 1. Store raw response and get the row ID back
        async with pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO raw_ingestion (time, source, endpoint, 
                    response_code, response_body)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING time, source
            """, datetime.utcnow(), self.name, self.endpoint, 
                response_code, json.dumps(raw_body))
            
            inserted_time = row['time']
            inserted_source = row['source']
        
        # 2. Parse and transform
        try:
            records = self.parse_response(raw_body)
            async with pool.acquire() as conn:
                await conn.execute("""
                    UPDATE raw_ingestion 
                    SET parse_status='ok', record_count=$1
                    WHERE time=$2 AND source=$3
                """, len(records), inserted_time, inserted_source)
            return records
        except Exception as e:
            async with pool.acquire() as conn:
                await conn.execute("""
                    UPDATE raw_ingestion 
                    SET parse_status='parse_error', parse_error=$1
                    WHERE time=$2 AND source=$3
                """, str(e), inserted_time, inserted_source)
            return []
```

### Continuous Aggregates (Phase 1 Schema — Not Phase 5)

CRITICAL: These aggregate views MUST exist in Phase 1 because
Phase 2 CorrelationEngine queries them for 30-day windows.
Without aggregates, CorrelationEngine would seq-scan raw
hypertables with millions of rows → CPU starvation.

Source: tigerdata.com/docs/build/continuous-aggregates/

```sql
-- Hourly aggregate for high-frequency GOES data
CREATE MATERIALIZED VIEW goes_flux_hourly
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

-- Hourly aggregate for solar wind data
CREATE MATERIALIZED VIEW solar_wind_hourly
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

-- Daily aggregate for atmospheric data
CREATE MATERIALIZED VIEW atmospheric_daily
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

-- Refresh policies (keep aggregates up to date)
-- start_offset: how far back to look for changes
-- end_offset: how recent to process (1 hour = near real-time)
-- schedule_interval: how often to refresh
SELECT add_continuous_aggregate_policy('goes_flux_hourly',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('solar_wind_hourly',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('atmospheric_daily',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');

-- NOTE: Retention and compression policies are added in Phase 5.
-- The aggregates exist from Phase 1 but raw data is kept until Phase 5.
```

---

## Collector Specifications

### Base Collector Class

```python
class BaseCollector:
    """Base class for all data collectors."""
    
    name: str                    # Collector name
    poll_interval: int           # Seconds between polls
    endpoint: str                # API endpoint URL
    timeout: int = 30            # Request timeout
    insert_query: str = ""       # Override in subclass with table-specific SQL
    
    def __init__(self, pool: asyncpg.Pool):
        """Pool must be injected at construction — collectors don't create pools."""
        self.pool = pool
        self.last_poll_time: datetime = None
    
    async def collect(self) -> list[dict]:
        """Fetch data from API, return list of records."""
        raise NotImplementedError
    
    def format_record(self, record: dict) -> tuple:
        """Convert record dict to tuple matching insert_query placeholders.
        Override in subclass."""
        raise NotImplementedError
    
    async def store(self, records: list[dict]) -> int:
        """Bulk insert with upsert. Uses executemany for performance.
        Override in subclass if multiple queries needed (e.g., SolarWind)."""
        if not records:
            return 0
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                values = [self.format_record(r) for r in records]
                await conn.executemany(self.insert_query, values)
                return len(values)
    
    async def log_status(self, status, count, elapsed, error=None):
        """Log collector health to collector_status table."""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO collector_status (time, collector, status, 
                    records_count, latency_ms, error_message)
                VALUES ($1, $2, $3, $4, $5, $6)
            """, datetime.utcnow(), self.name, status, 
                count, elapsed * 1000, error)
    
    async def run(self):
        """Main loop with time-drift correction and exponential backoff.
        
        If collector fails repeatedly, increase sleep time exponentially
        to avoid spamming a broken API.
        
        Source: Claude Review — "Tidak ada circuit breaker untuk collector"
        """
        consecutive_errors = 0
        max_backoff = 300  # 5 minutes max backoff
        
        while True:
            start = time.time()
            try:
                records = await self.collect()
                count = await self.store(records)
                await self.log_status('ok', count, time.time() - start)
                consecutive_errors = 0  # Reset on success
            except Exception as e:
                consecutive_errors += 1
                await self.log_status('error', 0, time.time() - start, str(e))
            
            # Time-drift correction + exponential backoff
            elapsed = time.time() - start
            base_sleep = max(0, self.poll_interval - elapsed)
            
            if consecutive_errors > 0:
                # Exponential backoff: 2^errors * 10 seconds, capped at max_backoff
                backoff = min(2 ** consecutive_errors * 10, max_backoff)
                sleep_time = max(base_sleep, backoff)
            else:
                sleep_time = base_sleep
            
            await asyncio.sleep(sleep_time)
```

### SolarWindCollector — Dual Query Override

```python
# solar_wind needs TWO separate queries because plasma and magnetometer
# data arrive from different NOAA files at different times.
# BaseCollector.store() only runs ONE query, so we override store().

class SolarWindCollector(BaseCollector):
    insert_query_plasma = """
        INSERT INTO solar_wind (time, source, density, speed, temperature)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (time, source) DO UPDATE SET
            density = COALESCE(EXCLUDED.density, solar_wind.density),
            speed = COALESCE(EXCLUDED.speed, solar_wind.speed),
            temperature = COALESCE(EXCLUDED.temperature, solar_wind.temperature)
    """
    insert_query_mag = """
        INSERT INTO solar_wind (time, source, bt, bx_gsm, by_gsm, bz_gsm, lon_gsm, lat_gsm)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (time, source) DO UPDATE SET
            bt = COALESCE(EXCLUDED.bt, solar_wind.bt),
            bx_gsm = COALESCE(EXCLUDED.bx_gsm, solar_wind.bx_gsm),
            by_gsm = COALESCE(EXCLUDED.by_gsm, solar_wind.by_gsm),
            bz_gsm = COALESCE(EXCLUDED.bz_gsm, solar_wind.bz_gsm)
    """
    
    async def store(self, records: list[dict]) -> int:
        """Override: run both plasma and mag queries."""
        if not records:
            return 0
        
        plasma_records = [r for r in records if r.get('data_type') == 'plasma']
        mag_records = [r for r in records if r.get('data_type') == 'mag']
        
        inserted = 0
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                if plasma_records:
                    values = [self.format_plasma(r) for r in plasma_records]
                    await conn.executemany(self.insert_query_plasma, values)
                    inserted += len(values)
                if mag_records:
                    values = [self.format_mag(r) for r in mag_records]
                    await conn.executemany(self.insert_query_mag, values)
                    inserted += len(values)
        
        return inserted
    
    def format_plasma(self, record: dict) -> tuple:
        return (record['time'], 'dscovr', record['density'], 
                record['speed'], record['temperature'])
    
    def format_mag(self, record: dict) -> tuple:
        return (record['time'], 'dscovr', record['bt'],
                record['bx_gsm'], record['by_gsm'], record['bz_gsm'],
                record.get('lon_gsm'), record.get('lat_gsm'))
```

# goes_flux — ON CONFLICT DO NOTHING (dedup by time+type+band+satellite)
class GOESFluxCollector(BaseCollector):
    insert_query = """
        INSERT INTO goes_flux (time, flux_type, energy_band, flux, satellite)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (time, flux_type, energy_band, satellite) DO NOTHING
    """

# space_weather_events — ON CONFLICT DO NOTHING
class DONKICollector(BaseCollector):
    insert_query = """
        INSERT INTO space_weather_events (time, event_id, event_type, source,
            speed, latitude, longitude, description, link, raw_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (time, event_id) DO NOTHING
    """

# atmospheric_data — ON CONFLICT DO UPDATE (latest reading per location)
class AtmosphericCollector(BaseCollector):
    insert_query = """
        INSERT INTO atmospheric_data (time, location_name, latitude, longitude,
            category, temperature, temp_min, precipitation, wind_speed, wind_dir)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (time, location_name) DO UPDATE SET
            temperature = COALESCE(EXCLUDED.temperature, atmospheric_data.temperature),
            temp_min = COALESCE(EXCLUDED.temp_min, atmospheric_data.temp_min),
            wind_speed = COALESCE(EXCLUDED.wind_speed, atmospheric_data.wind_speed)
    """

# volcanic_events — ON CONFLICT DO NOTHING
class VolcanicCollector(BaseCollector):
    insert_query = """
        INSERT INTO volcanic_events (time, event_id, volcano_name, latitude, longitude,
            elevation_m, event_type, vei, description, link, raw_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (time, event_id) DO NOTHING
    """
```

### Collector: Seismic (USGS)

```
POLL INTERVAL: 60 seconds (1 minute)
ENDPOINT: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson
DATA FORMAT: GeoJSON FeatureCollection

FIELDS EXTRACTED:
- event_id: feature.id
- magnitude: feature.properties.mag
- latitude: feature.geometry.coordinates[1]
- longitude: feature.geometry.coordinates[0]
- depth_km: feature.geometry.coordinates[2]
- place: feature.properties.place
- time: feature.properties.time (Unix ms → datetime)
- tsunami: feature.properties.tsunami
- sig: feature.properties.sig
- alert: feature.properties.alert
- felt: feature.properties.felt

DEDUPLICATION: ON event_id (skip if already exists)
```

### Collector: Solar Wind (NOAA SWPC)

```
POLL INTERVAL: 300 seconds (5 minutes)
ENDPOINTS:
- https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json
- https://services.swpc.noaa.gov/products/solar-wind/mag-7-day.json
DATA FORMAT: JSON array (header row + data rows)

FIELDS EXTRACTED (Plasma):
- time: time_tag
- density: density (protons/cm³)
- speed: speed (km/s)
- temperature: temperature (K)

FIELDS EXTRACTED (Magnetometer):
- time: time_tag
- bt: bt (nT)
- bx_gsm: bx_gsm (nT)
- by_gsm: by_gsm (nT)
- bz_gsm: bz_gsm (nT)

STRATEGY: Fetch 7-day file, filter for records newer than last stored timestamp
```

### Collector: GOES Flux (NOAA)

```
POLL INTERVAL: 60 seconds (1 minute)
ENDPOINTS:
- https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json
- https://services.swpc.noaa.gov/json/goes/primary/integral-protons-7-day.json
DATA FORMAT: JSON array

FIELDS EXTRACTED (X-ray):
- time: time_tag
- flux_type: 'xray'
- energy_band: '1-8A' or '0.5-4A'
- flux: flux (W/m²)

FIELDS EXTRACTED (Proton):
- time: time_tag
- flux_type: 'proton'
- energy_band: '>=10MeV', '>=50MeV', '>=100MeV'
- flux: flux

STRATEGY: Fetch 7-day file, filter for records newer than last stored timestamp
```

### Collector: NASA DONKI Events

```
POLL INTERVAL: 900 seconds (15 minutes)
ENDPOINTS:
- https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/CME?startDate=...
- https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/GST?startDate=...
- https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/FLR?startDate=...
- https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/IPS?startDate=...
DATA FORMAT: JSON array

DATE RANGE: Last 7 days (rolling window)

FIELDS EXTRACTED:
- event_id: activityID
- event_type: derived from endpoint (CME, GST, FLR, IPS)
- time: startTime
- source: sourceLocation
- speed: speed (for CMEs)
- description: various text fields
- raw_data: full JSON object
```

### Collector: Atmospheric (Open-Meteo)

```
POLL INTERVAL: 21600 seconds (6 hours)
ENDPOINT: https://api.open-meteo.com/v1/forecast
           (NOT archive-api — too slow, 1-2 day delay)
METHOD: Multi-coordinate batched requests (100 coords per request)

CRITICAL DISTINCTION:
  archive-api.open-meteo.com/v1/archive → OBSERVED data but 1-2 day delay
  api.open-meteo.com/v1/forecast?past_days=2&forecast_days=0
    → ALSO returns OBSERVED data (station + satellite reanalysis)
    → Available within ~15-30 minutes (effectively real-time)

  The "forecast" API name is misleading. With forecast_days=0,
  it returns ZERO predictions — only past observations.
  past_days=2 gives a rolling 2-day window that overlaps between
  poll cycles, ensuring no gaps.

  Why not archive API:
  - Requires start_date/end_date (past dates only)
  - Data available with 1-2 day delay
  - Cannot monitor "today" — always polling yesterday

  Why forecast API with past_days:
  - Same observation quality as archive (station + satellite reanalysis)
  - Near-real-time (~15-30 min delay vs 1-2 days)
  - Rolling window prevents data gaps
  - Free tier: 10,000 req/day (we use ~8/day)

PARAMETERS:
  ?latitude=...&longitude=...
  &past_days=2&forecast_days=0
  &daily=temperature_2m_max,temperature_2m_min,precipitation_sum,
         wind_speed_10m_max,wind_direction_10m_dominant
  &timezone=auto

BALANCED GRID: 150 Strategic Points (Not 259K Grid)
  Why 150, not 259K:
  - Other data sources are sparse: ~1000 seismic/day, ~10 DONKI/day
  - 259K atmospheric points would drown everything on the globe
  - 150 points = balanced visual weight across all domains
  - 150 dots on globe = clean, readable, professional
  
  Storage: 150 × 4 polls/day × 182 days = 109K rows for 6 months (~11 MB)
  API: 2 requests per poll × 4 polls/day = 8 requests/day (0.08% of free tier)

VARIABLES PER POINT:
  temperature_2m_max  — °C daily max
  temperature_2m_min  — °C daily min
  precipitation_sum   — mm daily total
  wind_speed_10m_max  — km/h daily max
  wind_direction_10m_dominant — degrees

DATA FORMAT: JSON array (one object per coordinate)

STRATEGY: Poll every 6 hours, store daily aggregates per point
EFFICIENCY: 2 API calls per poll cycle (150 points / 100 per request)
```

### Time Synchronization — Watermark System

```
PROBLEM: Different data sources have different latencies.
Correlating data with different ages introduces bias.

Source              Typical Latency    Max Acceptable
──────────────────  ───────────────    ──────────────
USGS Seismic        2-5 minutes        10 minutes
NOAA Solar Wind     5 minutes          15 minutes
GOES X-Ray          1-5 minutes        10 minutes
NASA DONKI          15-40 minutes      60 minutes
Open-Meteo          1-6 hours          120 minutes
NASA EONET          1-24 hours         180 minutes

SOLUTION: Watermark system (inspired by Apache Flink)
Each source has a "watermark" = latest reliable timestamp.
Correlation engine only processes data OLDER than max(latency).

```python
# Watermark configuration per source
SOURCE_WATERMARKS = {
    'seismic': timedelta(minutes=10),
    'solar_wind': timedelta(minutes=15),
    'goes': timedelta(minutes=10),
    'space_weather': timedelta(minutes=60),
    'atmospheric': timedelta(minutes=120),
    'volcanic': timedelta(minutes=180),
}

def get_watermark() -> datetime:
    """Get the global watermark: the oldest 'fresh' data point.
    Correlation engine only processes data older than this."""
    now = datetime.utcnow()
    return now - max(SOURCE_WATERMARKS.values())

# In CorrelationEngine.compute_correlation():
# Only use data older than watermark to avoid latency bias
watermark = get_watermark()
query = f"""
    SELECT time_bucket('1 hour', time) AS bucket, AVG({metric}) AS value
    FROM {table}
    WHERE time > '{watermark.isoformat()}'::timestamptz - INTERVAL '{window_hours} hours'
      AND time < '{watermark.isoformat()}'  -- Watermark filter
    GROUP BY bucket ORDER BY bucket
"""
# NOTE: Start of window is watermark - window_hours, NOT NOW() - window_hours.
# Using NOW() would give you (window_hours - watermark_age) hours of data,
# not the full window_hours you requested.
# Source: Gemini Review — "Watermark Window Off-by-One"
```

### Collector: Volcanic (NASA EONET)

```
POLL INTERVAL: 3600 seconds (1 hour)
PRIMARY SOURCE: NASA EONET (Earth Observatory Natural Event Tracker)
ENDPOINT: https://eonet.gsfc.nasa.gov/api/v3/events?category=volcanoes&status=open
BACKUP: https://eonet.gsfc.nasa.gov/api/v3/categories/volcanoes
FALLBACK: USGS Volcano Hazards RSS (if EONET unavailable)

DATA FORMAT: GeoJSON (structured, stable API — NOT HTML scraping)
AUTHENTICATION: None required
DOCUMENTATION: https://eonet.gsfc.nasa.gov/api/v3

EXAMPLE RESPONSE:
{
  "id": "EONET_20409",
  "title": "Telica Volcano, Nicaragua",
  "categories": [{"id": "volcanoes", "title": "Volcanoes"}],
  "sources": [{"id": "SIVolcano", "url": "https://volcano.si.edu/..."}],
  "geometry": [{
    "date": "2026-05-30T00:00:00Z",
    "type": "Point",
    "coordinates": [-86.84, 12.606]
  }],
  "closed": null  // null = still active
}

FIELDS EXTRACTED:
- event_id: event.id
- volcano_name: event.title
- latitude: event.geometry[-1].coordinates[1]
- longitude: event.geometry[-1].coordinates[0]
- time: event.geometry[-1].date
- status: "open" (active) or event.closed (resolved)
- source_url: event.sources[0].url

STRATEGY: Poll hourly, filter for events with closed=null (active)
EFFICIENCY: Single API call, structured JSON, no HTML parsing
NOTE: EONET aggregates from Smithsonian GVP, USGS, and other sources
```

---

## API Specification

### CORS Configuration (Required)

```python
from fastapi.middleware.cors import CORSMiddleware

# CRITICAL: allow_origins=["*"] + allow_credentials=True is ILLEGAL
# per CORS spec. Browsers will reject the request.
# Source: fastapi.tiangolo.com/tutorial/cors/
# "If allow_credentials=True, then allow_origins cannot be ['*']"
#
# Solution: List specific origins.

# Development origins
DEV_ORIGINS = [
    "http://localhost:5173",     # Vite dev server
    "http://localhost:3000",     # React dev server
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

# Production origins (update with your actual domain)
PROD_ORIGINS = [
    "https://tethys.pages.dev",           # Cloudflare Pages
    "https://api.tethys.yourdomain.com",  # Your domain
]

# Select based on environment
import os
TETHYS_ENV = os.getenv("TETHYS_ENV", "development")
ALLOWED_ORIGINS = PROD_ORIGINS if TETHYS_ENV == "production" else DEV_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # Specific origins, NOT wildcard
    allow_credentials=True,          # Safe with specific origins
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### WebSocket: Event-Driven (Not Polling) + Ping/Pong Keepalive

```python
# Store connected clients with last pong time
connected_clients: dict[WebSocket, float] = {}

# WebSocket broadcast rate limiting
# Prevents browser overload during seismic bursts (aftershocks)
# Source: Claude Review — "WebSocket broadcast tanpa rate limiting"
_broadcast_cooldown: dict[str, float] = {}  # type -> last broadcast time
BROADCAST_COOLDOWN_SECONDS = 2.0  # Max 1 broadcast per type per 2 seconds

async def broadcast_event(event: dict):
    """Send event to all connected clients when NEW data arrives.
    Rate-limited: max 1 broadcast per event type per 2 seconds.
    Called by collectors after successful store — NOT by a polling loop."""
    event_type = event.get('type', 'unknown')
    now = time.time()
    
    # Rate limit: skip if same type was broadcast recently
    last_broadcast = _broadcast_cooldown.get(event_type, 0)
    if now - last_broadcast < BROADCAST_COOLDOWN_SECONDS:
        return
    
    _broadcast_cooldown[event_type] = now
    
    message = json.dumps(event)
    disconnected = set()
    for client in connected_clients:
        try:
            await client.send_text(message)
        except:
            disconnected.add(client)
    for client in disconnected:
        connected_clients.pop(client, None)

# In collector.store():
# CRITICAL: Only broadcast NEW data (delta filter).
# After server restart, collectors fetch 7-day files with thousands of rows.
# Broadcasting all of them would flood WebSocket and crash browser memory.
# Solution: Only broadcast records newer than last_poll_time.

class BaseCollector:
    last_poll_time: datetime = None
    
    async def store(self, records: list[dict]) -> int:
        """Bulk insert with upsert. Uses executemany for performance."""
        if not records:
            return 0
        
        inserted = 0
        new_records = []
        
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                values = [self.format_record(r) for r in records]
                await conn.executemany(self.insert_query, values)
                inserted = len(values)
        
        # Only broadcast records NEWER than last poll (delta filter)
        # Prevents backfill flood on server restart
        if self.last_poll_time:
            new_records = [r for r in records if r['time'] > self.last_poll_time]
        else:
            # First run: don't broadcast historical backfill
            new_records = []
        
        self.last_poll_time = datetime.utcnow()
        
        # Batch broadcast: send one message with all new records
        # instead of one message per record
        if new_records:
            await broadcast_event({
                "type": self.name,
                "data": new_records,  # Array, not individual records
                "count": len(new_records),
                "timestamp": datetime.utcnow().isoformat()
            })
        
        return inserted

# WebSocket ping/pong keepalive (MUST IMPLEMENT)
# Source: websockets.readthedocs.io/en/13.0.1/topics/keepalive.html
# Source: websocket.org/guides/heartbeat/
#
# Problem: Reverse proxies (Nginx 60s, Cloudflare 100s) kill idle
# TCP connections. Browser WebSocket API cannot send protocol-level
# ping frames. Without keepalive, connections silently die.
#
# Solution: Application-level heartbeat every 30 seconds.
# Per the 75% rule: heartbeat_interval = 0.75 * shortest_proxy_timeout
# Nginx default 60s → heartbeat every 45s. We use 30s for safety.

import asyncio

async def websocket_heartbeat():
    """Background task: ping all clients every 30 seconds.
    If no pong within 60 seconds, close dead connection."""
    while True:
        await asyncio.sleep(30)
        now = time.time()
        dead = []
        for ws, last_pong in connected_clients.items():
            if now - last_pong > 60:
                dead.append(ws)
            else:
                try:
                    await ws.send_json({"type": "ping"})
                except:
                    dead.append(ws)
        for ws in dead:
            connected_clients.pop(ws, None)
            try:
                await ws.close()
            except:
                pass

# In WebSocket endpoint:
@app.websocket("/ws/v1/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients[websocket] = time.time()
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "pong":
                connected_clients[websocket] = time.time()
            
            elif data.get("type") == "sync_request":
                # Client (re)connected or tab became visible.
                # Send last 24 hours of data so UI is immediately current.
                # Source: Gemini Review — "Black Hole sync_request"
                recent_data = await get_recent_events(hours=24)
                await websocket.send_json({
                    "type": "sync_response",
                    "data": recent_data,
                    "timestamp": datetime.utcnow().isoformat()
                })
    except WebSocketDisconnect:
        connected_clients.pop(websocket, None)

# Start heartbeat task using lifespan (not deprecated on_event)
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    pool = await init_pool(DATABASE_URL)
    asyncio.create_task(websocket_heartbeat())
    
    # NOTE: Collectors are NOT started here.
    # --workers 2 would fork this process, creating duplicate collectors
    # that double API calls and cause database deadlocks.
    # Collectors run in a separate service: tethys-collector.service
    #
    # Source: Gemini Review — "Bom Multi-Proses Uvicorn"
    
    yield
    
    # Shutdown
    await close_pool()

app = FastAPI(lifespan=lifespan)
```

### Frontend WebSocket Ping/Pong

```typescript
// hooks/useWebSocket.ts
// Browser WebSocket API cannot send protocol-level ping frames.
// Must use application-level heartbeat (JSON messages).
// Source: websocket.org/guides/heartbeat/

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);  // Prevent double-connect (React 18 StrictMode)
  const isPageVisibleRef = useRef(true);
  
  useEffect(() => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    
    // PAGE VISIBILITY API:
    // When user minimizes browser or switches tab, Chrome/Firefox/Safari
    // throttle setTimeout/setInterval and freeze requestAnimationFrame.
    // WebSocket still receives data → buffer grows, state desyncs.
    // Solution: Pause WebSocket processing when hidden, sync on visibility.
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
      if (document.hidden) {
        // Tab hidden: pause 3D render, buffer WebSocket data
        console.log('[Tethys] Tab hidden — pausing render, buffering data');
      } else {
        // Tab visible: flush buffer, resume render, sync state
        console.log('[Tethys] Tab visible — syncing data, resuming render');
        // Force immediate data refresh from API
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "sync_request" }));
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    const connect = () => {
      const ws = new WebSocket(`wss://${API_HOST}/ws/v1/live`);
      
      ws.onopen = () => {
        pongTimeoutRef.current = setTimeout(() => {
          ws.close();
        }, 60000);
      };
      
      ws.onmessage = (event) => {
        // Skip processing when tab is hidden (prevent buffer bloat)
        if (!isPageVisibleRef.current) return;
        
        const data = JSON.parse(event.data);
        
        if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
          pongTimeoutRef.current = setTimeout(() => {
            ws.close();
          }, 60000);
          return;
        }
        
        // Handle data events...
      };
      
      ws.onclose = () => {
        if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
        isConnectingRef.current = false;
        setTimeout(connect, 3000);
      };
      
      wsRef.current = ws;
    };
    
    connect();
    
    return () => {
      isConnectingRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);
}

### Base URL: `http://<vps-ip>:8000/api/v1`

NOTE: All endpoints use /api/v1/ prefix for versioning.
When API changes in Phase 5, v1 remains stable for deployed frontend.
Future versions: /api/v2/, /api/v3/, etc.

### Endpoints

```
GET  /api/v1/status
     Returns system health and collector status
     Response: {
       "status": "operational",
       "uptime_seconds": 12345,
       "collectors": {
         "seismic": {"status": "ok", "last_poll": "...", "records": 1234},
         "solar_wind": {"status": "ok", "last_poll": "...", "records": 5678},
         ...
       },
       "database": {
         "total_records": 50000,
         "storage_mb": 123.4
       }
     }

GET  /api/v1/events/seismic?hours=24&min_mag=4.0&limit=100
     Query seismic events
     Response: {
       "count": 42,
       "events": [
         {
           "time": "2026-06-18T14:23:00Z",
           "magnitude": 5.2,
           "latitude": 38.5,
           "longitude": 142.8,
           "depth_km": 35.0,
           "place": "123km NE of Honshu, Japan",
           "tsunami": 0,
           "sig": 400
         },
         ...
       ]
     }

GET  /api/v1/events/space-weather?hours=24&type=CME&limit=50
     Query space weather events
     Response: {
       "count": 3,
       "events": [
         {
           "time": "2026-06-18T10:00:00Z",
           "event_type": "CME",
           "speed": 1200,
           "source": "S25W30",
           "description": "..."
         },
         ...
       ]
     }

GET  /api/v1/solar-wind/latest
     Latest solar wind readings
     Response: {
       "plasma": {
         "time": "...",
         "density": 7.04,
         "speed": 378.8,
         "temperature": 125000
       },
       "magnetic": {
         "time": "...",
         "bt": 4.68,
         "bz_gsm": 0.51,
         "bx_gsm": -2.1,
         "by_gsm": 3.2
       }
     }

GET  /api/v1/goes/xray?hours=24
     X-ray flux data
     Response: {
       "readings": [
         {"time": "...", "band": "1-8A", "flux": 1.2e-6},
         ...
       ],
       "latest_flare": {
         "time": "...",
         "class": "B8.1",
         "flux": 8.1e-7
       }
     }

GET  /api/v1/atmospheric?lat=-6.2&lon=106.8&hours=24
     Atmospheric data for a location
     Response: {
       "location": {"lat": -6.2, "lon": 106.8, "name": "Jakarta"},
       "readings": [
         {"time": "...", "temperature": 28.5, "pressure": 1013.2, ...},
         ...
       ]
     }

GET  /api/v1/volcanic?days=30
     Recent volcanic events

WS   /ws/v1/live
     WebSocket: real-time event stream
     Messages: {
       "type": "seismic|solar_wind|goes|space_weather|atmospheric|volcanic",
       "data": { ... },
       "timestamp": "..."
     }
```

---

## Scheduler

```python
# Main orchestrator
async def main():
    # Initialize database
    await init_db()
    
    # Start all collectors as concurrent tasks
    collectors = [
        SeismicCollector(poll_interval=60),
        SolarWindCollector(poll_interval=300),
        GOESFluxCollector(poll_interval=60),
        DONKICollector(poll_interval=900),
        AtmosphericCollector(poll_interval=3600),
        VolcanicCollector(poll_interval=86400),
    ]
    
    # Start FastAPI server
    api_task = asyncio.create_task(run_api())
    
    # Start all collectors
    collector_tasks = [asyncio.create_task(c.run()) for c in collectors]
    
    # Wait forever
    await asyncio.gather(api_task, *collector_tasks)
```

---

## Configuration

```python
# config.py
import os

# CRITICAL: No insecure defaults. Fail loudly if not configured.
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is required. "
        "Example: postgresql://tethys:***@localhost:5432/tethys"
    )

API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = int(os.getenv("API_PORT", "8000"))

# Collector intervals (seconds)
SEISMIC_POLL_INTERVAL = 60
SOLAR_WIND_POLL_INTERVAL = 300
GOES_POLL_INTERVAL = 60
DONKI_POLL_INTERVAL = 900
ATMOSPHERIC_POLL_INTERVAL = 3600
VOLCANIC_POLL_INTERVAL = 86400

# Open-Meteo grid points (lat, lon, name)
ATMOSPHERIC_LOCATIONS = [
    (-6.2088, 106.8456, "Jakarta"),
    (35.6762, 139.6503, "Tokyo"),
    (40.7128, -74.0060, "New York"),
    (51.5074, -0.1278, "London"),
    (-33.8688, 151.2093, "Sydney"),
    # ... more cities
]
```

---

## Dependencies

```
# requirements.txt (backend)
fastapi==0.115.0
uvicorn[standard]==0.32.0
asyncpg==0.30.0
aiohttp==3.11.0
pydantic==2.10.0
python-dotenv==1.0.0
psycopg2-binary==2.9.10
numpy==1.26.0
scipy==1.14.0
scikit-learn==1.5.0
statsmodels==0.14.0       # FDR correction (Benjamini-Hochberg)
joblib==1.4.0             # Isolation Forest model serialization
```

```
# package.json dependencies (frontend — Phase 3)
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-globe.gl": "^2.38.0",
    "three": "^0.183.0",
    "zustand": "^5.0.0",
    "axios": "^1.7.0",
    "recharts": "^3.0.0",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^8.0.0",
    "@types/react": "^19.0.0",
    "@types/leaflet": "^1.9.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "jest": "^29.7.0",
    "@testing-library/react": "^16.0.0"
  }
}
```

---

## Deployment (VPS)

### Systemd Service

See INFRASTRUCTURE.md for the complete, production-ready systemd configuration.
The INFRASTRUCTURE.md version uses EnvironmentFile=/opt/tethys/backend/.env
instead of hardcoded credentials.

```ini
# /etc/systemd/system/tethys.service
# See INFRASTRUCTURE.md for full production config with:
# - EnvironmentFile (not hardcoded credentials)
# - Security hardening (NoNewPrivileges, ProtectSystem)
# - Resource limits (MemoryMax, CPUQuota)
```

### Database Setup

```bash
# Install PostgreSQL + TimescaleDB
sudo apt install postgresql postgresql-contrib
# Add TimescaleDB repo and install extension
sudo apt install timescaledb-2-postgresql-16

# Create database and user
sudo -u postgres psql
CREATE USER tethys WITH PASSWORD 'tethys';
CREATE DATABASE tethys OWNER tethys;
\c tethys
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

---

## Phase 1 Deliverables

1. ✅ All 6 collectors running 24/7 on VPS
2. ✅ TimescaleDB storing real-time data from all sources
3. ✅ REST API queryable from anywhere
4. ✅ WebSocket streaming live events
5. ✅ System health dashboard (simple HTML)
6. ✅ Data flowing for at least 48 hours continuously

## Phase 1 Success Criteria

- [ ] Seismic data: >100 events/day stored
- [ ] Solar wind: 5-minute cadence data flowing
- [ ] GOES X-ray: 1-minute cadence data flowing
- [ ] DONKI events: Space weather events captured
- [ ] Atmospheric: 20 cities, hourly updates
- [ ] Volcanic: Daily reports ingested
- [ ] API response time: <100ms for queries
- [ ] Zero data loss: All events stored, no duplicates
- [ ] Uptime: 48+ hours continuous operation