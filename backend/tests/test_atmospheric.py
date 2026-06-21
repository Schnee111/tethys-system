"""Tethys — Tests for AtmosphericCollector."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.collectors.atmospheric import (
    STRATEGIC_POINTS_MVP,
    AtmosphericCollector,
    _make_request_coords,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

# Sample Open-Meteo response for a single location (multi-coord returns list)
SAMPLE_RESPONSE_SINGLE = {
    "latitude": -6.21,
    "longitude": 106.85,
    "generationtime_ms": 0.5,
    "utc_offset_seconds": 25200,
    "timezone": "Asia/Jakarta",
    "daily_units": {
        "time": "iso8601",
        "temperature_2m_max": "°C",
        "temperature_2m_min": "°C",
        "precipitation_sum": "mm",
        "wind_speed_10m_max": "km/h",
        "wind_direction_10m_dominant": "°",
    },
    "daily": {
        "time": ["2026-06-19", "2026-06-20"],
        "temperature_2m_max": [35.4, 34.9],
        "temperature_2m_min": [25.2, 25.1],
        "precipitation_sum": [0.0, 7.8],
        "wind_speed_10m_max": [13.1, 11.3],
        "wind_direction_10m_dominant": [79, 94],
    },
}

SAMPLE_RESPONSE_TOKYO = {
    "latitude": 35.68,
    "longitude": 139.69,
    "generationtime_ms": 0.3,
    "utc_offset_seconds": 32400,
    "timezone": "Asia/Tokyo",
    "daily_units": {},
    "daily": {
        "time": ["2026-06-19", "2026-06-20"],
        "temperature_2m_max": [28.1, 27.5],
        "temperature_2m_min": [20.3, 19.8],
        "precipitation_sum": [5.2, 0.0],
        "wind_speed_10m_max": [18.0, 15.6],
        "wind_direction_10m_dominant": [180, 210],
    },
}

# Multi-location response (list)
SAMPLE_RESPONSE_MULTI = [SAMPLE_RESPONSE_SINGLE, SAMPLE_RESPONSE_TOKYO]

SAMPLE_POINT_JAKARTA = {"name": "Jakarta", "lat": -6.21, "lon": 106.85, "category": "cities"}
SAMPLE_POINT_TOKYO = {"name": "Tokyo", "lat": 35.68, "lon": 139.69, "category": "cities"}

# Response with missing fields
RESPONSE_MISSING_FIELDS = {
    "latitude": 0.0,
    "longitude": 0.0,
    "daily": {
        "time": ["2026-06-19"],
        "temperature_2m_max": [None],
        "temperature_2m_min": [None],
        "precipitation_sum": [None],
        "wind_speed_10m_max": [],
        "wind_direction_10m_dominant": [],
    },
}

# Empty response
RESPONSE_EMPTY_DAILY = {
    "latitude": 10.0,
    "longitude": 20.0,
    "daily": {
        "time": [],
        "temperature_2m_max": [],
        "temperature_2m_min": [],
        "precipitation_sum": [],
        "wind_speed_10m_max": [],
        "wind_direction_10m_dominant": [],
    },
}


@pytest.fixture
def mock_pool():
    """Create a mock asyncpg pool with working async context managers."""
    conn = AsyncMock()

    transaction_ctx = AsyncMock()
    transaction_ctx.__aenter__ = AsyncMock(return_value=None)
    transaction_ctx.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=transaction_ctx)

    acquire_ctx = AsyncMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=False)

    pool = AsyncMock()
    pool.acquire = MagicMock(return_value=acquire_ctx)

    return pool, conn


@pytest.fixture
def collector(mock_pool):
    """AtmosphericCollector with mock pool and 2-city MVP."""
    pool, _ = mock_pool
    return AtmosphericCollector(
        pool,
        points=[SAMPLE_POINT_JAKARTA, SAMPLE_POINT_TOKYO],
        batch_size=2,
    )


@pytest.fixture
def collector_default(mock_pool):
    """AtmosphericCollector with default MVP points."""
    pool, _ = mock_pool
    return AtmosphericCollector(pool)


# ---------------------------------------------------------------------------
# Class configuration tests
# ---------------------------------------------------------------------------


def test_collector_attributes(collector):
    """Collector has correct name, interval, endpoint."""
    assert collector.name == "atmospheric"
    assert collector.poll_interval == 21600  # 6 hours
    assert "api.open-meteo.com" in collector.endpoint
    assert collector.timeout == 60
    assert "INSERT INTO atmospheric_data" in collector.insert_query
    assert "ON CONFLICT" in collector.insert_query
    assert "DO UPDATE SET" in collector.insert_query


def test_strategic_points_mvp():
    """MVP has 20 cities with correct structure."""
    assert len(STRATEGIC_POINTS_MVP) == 20
    for p in STRATEGIC_POINTS_MVP:
        assert "name" in p
        assert "lat" in p
        assert "lon" in p
        assert "category" in p
        assert p["category"] == "cities"
        assert -90 <= p["lat"] <= 90
        assert -180 <= p["lon"] <= 180


def test_default_points(collector_default):
    """Default collector uses MVP points."""
    assert len(collector_default.points) == 20
    assert collector_default.batch_size == 10


def test_custom_points(collector):
    """Custom points override defaults."""
    assert len(collector.points) == 2
    assert collector.batch_size == 2


# ---------------------------------------------------------------------------
# _make_request_coords tests
# ---------------------------------------------------------------------------


def test_make_request_coords():
    """Builds comma-separated lat/lon strings."""
    points = [
        {"name": "A", "lat": 1.0, "lon": 2.0, "category": "cities"},
        {"name": "B", "lat": 3.0, "lon": 4.0, "category": "cities"},
    ]
    result = _make_request_coords(points)
    assert result["latitude"] == "1.0,3.0"
    assert result["longitude"] == "2.0,4.0"


def test_make_request_coords_single():
    """Single point produces non-comma-separated value."""
    points = [{"name": "X", "lat": -6.21, "lon": 106.85, "category": "cities"}]
    result = _make_request_coords(points)
    assert result["latitude"] == "-6.21"
    assert result["longitude"] == "106.85"


# ---------------------------------------------------------------------------
# _parse_date tests
# ---------------------------------------------------------------------------


def test_parse_date():
    """Date string parses to midday UTC datetime."""
    result = AtmosphericCollector._parse_date("2026-06-19")
    assert result == datetime(2026, 6, 19, 12, 0, 0, tzinfo=UTC)


def test_parse_date_different_format():
    """ISO date with zero-padded values."""
    result = AtmosphericCollector._parse_date("2025-01-05")
    assert result == datetime(2025, 1, 5, 12, 0, 0, tzinfo=UTC)


# ---------------------------------------------------------------------------
# _safe_float tests
# ---------------------------------------------------------------------------


def test_safe_float_valid():
    """Extracts float from array at valid index."""
    assert AtmosphericCollector._safe_float([1.0, 2.0, 3.0], 1) == 2.0


def test_safe_float_none_value():
    """Returns None when array value is None."""
    assert AtmosphericCollector._safe_float([1.0, None, 3.0], 1) is None


def test_safe_float_out_of_bounds():
    """Returns None when index is out of bounds."""
    assert AtmosphericCollector._safe_float([1.0], 5) is None


def test_safe_float_empty_array():
    """Returns None for empty array."""
    assert AtmosphericCollector._safe_float([], 0) is None


def test_safe_float_integer_to_float():
    """Integer values are converted to float."""
    assert AtmosphericCollector._safe_float([10, 20, 30], 2) == 30.0


# ---------------------------------------------------------------------------
# _parse_daily_response tests
# ---------------------------------------------------------------------------


def test_parse_daily_response(collector):
    """Parses multi-day response into record list."""
    records = collector._parse_daily_response(SAMPLE_RESPONSE_SINGLE, SAMPLE_POINT_JAKARTA)

    assert len(records) == 2

    # First day
    r0 = records[0]
    assert r0["time"] == datetime(2026, 6, 19, 12, 0, 0, tzinfo=UTC)
    assert r0["location_name"] == "Jakarta"
    assert r0["latitude"] == -6.21
    assert r0["longitude"] == 106.85
    assert r0["category"] == "cities"
    assert r0["temperature"] == 35.4
    assert r0["temp_min"] == 25.2
    assert r0["precipitation"] == 0.0
    assert r0["wind_speed"] == 13.1
    assert r0["wind_dir"] == 79.0

    # Second day
    r1 = records[1]
    assert r1["time"] == datetime(2026, 6, 20, 12, 0, 0, tzinfo=UTC)
    assert r1["temperature"] == 34.9
    assert r1["temp_min"] == 25.1
    assert r1["precipitation"] == 7.8
    assert r1["wind_speed"] == 11.3
    assert r1["wind_dir"] == 94.0


def test_parse_daily_response_empty(collector):
    """Empty daily arrays produce empty record list."""
    records = collector._parse_daily_response(RESPONSE_EMPTY_DAILY, SAMPLE_POINT_JAKARTA)
    assert records == []


def test_parse_daily_response_missing_fields(collector):
    """Null values in arrays are parsed as None."""
    point = {"name": "Test", "lat": 0.0, "lon": 0.0, "category": "ocean"}
    records = collector._parse_daily_response(RESPONSE_MISSING_FIELDS, point)

    assert len(records) == 1
    r = records[0]
    assert r["temperature"] is None
    assert r["temp_min"] is None
    assert r["precipitation"] is None
    # wind_speed and wind_dir arrays are empty, so out of bounds -> None
    assert r["wind_speed"] is None
    assert r["wind_dir"] is None


def test_parse_daily_response_uses_response_coords(collector):
    """Uses lat/lon from response when available."""
    records = collector._parse_daily_response(SAMPLE_RESPONSE_SINGLE, SAMPLE_POINT_JAKARTA)
    assert records[0]["latitude"] == -6.21
    assert records[0]["longitude"] == 106.85


# ---------------------------------------------------------------------------
# format_record tests
# ---------------------------------------------------------------------------


def test_format_record_tuple_length(collector):
    """format_record returns 10-element tuple matching INSERT placeholders."""
    records = collector._parse_daily_response(SAMPLE_RESPONSE_SINGLE, SAMPLE_POINT_JAKARTA)
    result = collector.format_record(records[0])

    assert isinstance(result, tuple)
    assert len(result) == 10


def test_format_record_values(collector):
    """format_record tuple values match expected order."""
    records = collector._parse_daily_response(SAMPLE_RESPONSE_SINGLE, SAMPLE_POINT_JAKARTA)
    result = collector.format_record(records[0])

    assert result[0] == datetime(2026, 6, 19, 12, 0, 0, tzinfo=UTC)  # time
    assert result[1] == "Jakarta"  # location_name
    assert result[2] == -6.21  # latitude
    assert result[3] == 106.85  # longitude
    assert result[4] == "cities"  # category
    assert result[5] == 35.4  # temperature
    assert result[6] == 25.2  # temp_min
    assert result[7] == 0.0  # precipitation
    assert result[8] == 13.1  # wind_speed
    assert result[9] == 79.0  # wind_dir


# ---------------------------------------------------------------------------
# collect() tests (mocked HTTP)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_collect_single_batch(collector):
    """collect() fetches and parses response for single batch."""
    collector.fetch_json = AsyncMock(return_value=[SAMPLE_RESPONSE_SINGLE, SAMPLE_RESPONSE_TOKYO])

    records = await collector.collect()

    # 2 cities * 2 days = 4 records
    assert len(records) == 4
    assert records[0]["location_name"] == "Jakarta"
    assert records[2]["location_name"] == "Tokyo"


@pytest.mark.asyncio
async def test_collect_multiple_batches(mock_pool):
    """collect() handles multiple batches correctly."""
    pool, _ = mock_pool
    # 4 points with batch_size=2 → 2 batches
    points = [
        SAMPLE_POINT_JAKARTA,
        SAMPLE_POINT_TOKYO,
        {"name": "London", "lat": 51.51, "lon": -0.13, "category": "cities"},
        {"name": "Paris", "lat": 48.86, "lon": 2.35, "category": "cities"},
    ]
    c = AtmosphericCollector(pool, points=points, batch_size=2)

    c.fetch_json = AsyncMock(
        side_effect=[
            [SAMPLE_RESPONSE_SINGLE, SAMPLE_RESPONSE_TOKYO],
            [SAMPLE_RESPONSE_SINGLE, SAMPLE_RESPONSE_TOKYO],  # reuse for London/Paris
        ]
    )

    records = await c.collect()
    assert len(records) == 8  # 4 points * 2 days each
    assert c.fetch_json.call_count == 2


@pytest.mark.asyncio
async def test_collect_empty_response(mock_pool):
    """collect() handles empty daily response gracefully."""
    pool, _ = mock_pool
    c = AtmosphericCollector(pool, points=[SAMPLE_POINT_JAKARTA], batch_size=1)

    empty_resp = {
        "latitude": -6.21,
        "longitude": 106.85,
        "daily": {
            "time": [],
            "temperature_2m_max": [],
            "temperature_2m_min": [],
            "precipitation_sum": [],
            "wind_speed_10m_max": [],
            "wind_direction_10m_dominant": [],
        },
    }
    c.fetch_json = AsyncMock(return_value=empty_resp)

    records = await c.collect()
    assert records == []


@pytest.mark.asyncio
async def test_collect_api_url_construction(collector):
    """collect() constructs correct API URL with parameters."""
    collector.fetch_json = AsyncMock(return_value=[SAMPLE_RESPONSE_SINGLE, SAMPLE_RESPONSE_TOKYO])

    await collector.collect()

    called_url = collector.fetch_json.call_args[0][0]
    assert "api.open-meteo.com" in called_url
    assert "past_days=" in called_url
    assert "forecast_days=0" in called_url
    assert "temperature_2m_max" in called_url
    assert "temperature_2m_min" in called_url
    assert "precipitation_sum" in called_url
    assert "wind_speed_10m_max" in called_url
    assert "wind_direction_10m_dominant" in called_url
    assert "timezone=auto" in called_url
    # Check coordinates are present
    assert "-6.21" in called_url
    assert "35.68" in called_url


# ---------------------------------------------------------------------------
# store() integration (via base class executemany)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_store_calls_executemany(mock_pool):
    """store() calls executemany with formatted records."""
    pool, conn = mock_pool
    c = AtmosphericCollector(pool, points=[SAMPLE_POINT_JAKARTA], batch_size=1)

    records = c._parse_daily_response(SAMPLE_RESPONSE_SINGLE, SAMPLE_POINT_JAKARTA)
    count = await c.store(records)

    assert count == 2
    conn.executemany.assert_called_once()
    call_args = conn.executemany.call_args
    assert call_args[0][0] == c.insert_query
    assert len(call_args[0][1]) == 2


@pytest.mark.asyncio
async def test_store_empty(mock_pool):
    """store() returns 0 for empty list."""
    pool, conn = mock_pool
    c = AtmosphericCollector(pool)

    count = await c.store([])
    assert count == 0
    conn.executemany.assert_not_called()


# ---------------------------------------------------------------------------
# Full collect -> format -> store pipeline
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_full_pipeline(mock_pool):
    """End-to-end: collect -> format_record -> store."""
    pool, conn = mock_pool
    c = AtmosphericCollector(
        pool,
        points=[SAMPLE_POINT_JAKARTA, SAMPLE_POINT_TOKYO],
        batch_size=2,
    )
    c.fetch_json = AsyncMock(return_value=[SAMPLE_RESPONSE_SINGLE, SAMPLE_RESPONSE_TOKYO])

    # Collect
    records = await c.collect()
    assert len(records) == 4

    # Format each record — should not raise
    for r in records:
        tup = c.format_record(r)
        assert len(tup) == 10

    # Store
    count = await c.store(records)
    assert count == 4
    conn.executemany.assert_called_once()


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_collect_single_coord_response(mock_pool):
    """Handles single-object response (not wrapped in list) for single-point batch."""
    pool, _ = mock_pool
    c = AtmosphericCollector(pool, points=[SAMPLE_POINT_JAKARTA], batch_size=1)

    # Single coordinate returns dict, not list
    c.fetch_json = AsyncMock(return_value=SAMPLE_RESPONSE_SINGLE)

    records = await c.collect()
    assert len(records) == 2
    assert records[0]["location_name"] == "Jakarta"


def test_format_record_with_none_values(collector):
    """format_record handles None values without errors."""
    record = {
        "time": datetime(2026, 6, 19, 12, 0, 0, tzinfo=UTC),
        "location_name": "Test",
        "latitude": 0.0,
        "longitude": 0.0,
        "category": "ocean",
        "temperature": None,
        "temp_min": None,
        "precipitation": None,
        "wind_speed": None,
        "wind_dir": None,
    }
    result = collector.format_record(record)
    assert len(result) == 10
    assert result[5] is None  # temperature
    assert result[6] is None  # temp_min
    assert result[7] is None  # precipitation
    assert result[8] is None  # wind_speed
    assert result[9] is None  # wind_dir
