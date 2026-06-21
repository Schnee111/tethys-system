"""Tethys — Tests for SeismicCollector."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.collectors.seismic import SeismicCollector

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_GEOJSON = {
    "type": "FeatureCollection",
    "metadata": {
        "generated": 1700000000000,
        "url": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
        "title": "USGS All Earthquakes, Past Hour",
        "count": 2,
    },
    "features": [
        {
            "type": "Feature",
            "id": "us7000abc1",
            "properties": {
                "mag": 4.5,
                "place": "28 km SSE of Kaktovik, Alaska",
                "time": 1700000100000,
                "updated": 1700000200000,
                "type": "earthquake",
                "title": "M 4.5 - 28 km SSE of Kaktovik, Alaska",
                "tsunami": 0,
                "sig": 312,
                "alert": "green",
                "felt": 12,
                "cdi": 3.1,
                "mmi": 2.8,
                "magType": "mb",
                "net": "us",
            },
            "geometry": {
                "type": "Point",
                "coordinates": [-143.8758, 69.7234, 10.5],
            },
        },
        {
            "type": "Feature",
            "id": "ci12345678",
            "properties": {
                "mag": 2.1,
                "place": "5 km NW of The Geysers, CA",
                "time": 1700000050000,
                "updated": 1700000150000,
                "type": "earthquake",
                "title": "M 2.1 - 5 km NW of The Geysers, CA",
                "tsunami": 0,
                "sig": 68,
                "alert": None,
                "felt": None,
                "cdi": None,
                "mmi": None,
                "magType": "ml",
                "net": "ci",
            },
            "geometry": {
                "type": "Point",
                "coordinates": [-122.7783333, 38.8058333, 2.1],
            },
        },
    ],
}

EMPTY_GEOJSON = {
    "type": "FeatureCollection",
    "metadata": {},
    "features": [],
}

FEATURE_MINIMAL = {
    "type": "Feature",
    "id": "us99999999",
    "properties": {
        "mag": 1.0,
        "place": "Somewhere",
        "time": 1700000000000,
        "type": "earthquake",
        "tsunami": 0,
        "sig": 10,
    },
    "geometry": {
        "type": "Point",
        "coordinates": [0.0, 0.0, 0.0],
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
    """SeismicCollector with mock pool."""
    pool, _ = mock_pool
    return SeismicCollector(pool)


# ---------------------------------------------------------------------------
# Class configuration tests
# ---------------------------------------------------------------------------


def test_collector_attributes(collector):
    """Collector has correct name, interval, endpoint."""
    assert collector.name == "seismic"
    assert collector.poll_interval == 60
    assert "earthquake.usgs.gov" in collector.endpoint
    assert collector.timeout == 30
    assert "INSERT INTO seismic_events" in collector.insert_query
    assert "ON CONFLICT" in collector.insert_query


# ---------------------------------------------------------------------------
# _parse_feature tests
# ---------------------------------------------------------------------------


def test_parse_feature_full(collector):
    """Parse a fully-populated GeoJSON feature."""
    feature = SAMPLE_GEOJSON["features"][0]
    record = collector._parse_feature(feature)

    expected_time = datetime.fromtimestamp(1700000100000 / 1000, tz=UTC)
    assert record["time"] == expected_time
    assert record["event_id"] == "us7000abc1"
    assert record["magnitude"] == 4.5
    assert record["latitude"] == 69.7234
    assert record["longitude"] == -143.8758
    assert record["depth_km"] == 10.5
    assert record["place"] == "28 km SSE of Kaktovik, Alaska"
    assert record["type"] == "earthquake"
    assert record["tsunami"] == 0
    assert record["sig"] == 312
    assert record["alert"] == "green"
    assert record["felt"] == 12
    assert record["mag_type"] == "mb"
    assert record["net"] == "us"
    assert record["raw_data"] == feature  # full feature stored


def test_parse_feature_null_fields(collector):
    """Parse feature with null/None alert and felt."""
    feature = SAMPLE_GEOJSON["features"][1]
    record = collector._parse_feature(feature)

    assert record["event_id"] == "ci12345678"
    assert record["magnitude"] == 2.1
    assert record["alert"] is None
    assert record["felt"] is None
    assert record["mag_type"] == "ml"
    assert record["net"] == "ci"


def test_parse_feature_minimal(collector):
    """Parse feature with minimal fields (missing optional ones)."""
    record = collector._parse_feature(FEATURE_MINIMAL)

    assert record["event_id"] == "us99999999"
    assert record["magnitude"] == 1.0
    assert record["latitude"] == 0.0
    assert record["longitude"] == 0.0
    assert record["depth_km"] == 0.0
    assert record["mag_type"] is None
    assert record["net"] is None


def test_parse_feature_none_magnitude(collector):
    """Magnitude of None should be coerced to 0.0."""
    feature = {
        "id": "test123",
        "properties": {
            "mag": None,
            "time": 1700000000000,
            "type": "earthquake",
            "tsunami": 0,
            "sig": 0,
        },
        "geometry": {"coordinates": [1.0, 2.0, 3.0]},
    }
    record = collector._parse_feature(feature)
    assert record["magnitude"] == 0.0


# ---------------------------------------------------------------------------
# format_record tests
# ---------------------------------------------------------------------------


def test_format_record_tuple_length(collector):
    """format_record returns 15-element tuple matching INSERT placeholders."""
    feature = SAMPLE_GEOJSON["features"][0]
    record = collector._parse_feature(feature)
    result = collector.format_record(record)

    assert isinstance(result, tuple)
    assert len(result) == 15


def test_format_record_values(collector):
    """format_record tuple values match expected order."""
    feature = SAMPLE_GEOJSON["features"][0]
    record = collector._parse_feature(feature)
    result = collector.format_record(record)

    expected_time = datetime.fromtimestamp(1700000100000 / 1000, tz=UTC)
    assert result[0] == expected_time  # time
    assert result[1] == "us7000abc1"  # event_id
    assert result[2] == 4.5  # magnitude
    assert result[3] == 69.7234  # latitude
    assert result[4] == -143.8758  # longitude
    assert result[5] == 10.5  # depth_km
    assert result[6] == "28 km SSE of Kaktovik, Alaska"  # place
    assert result[7] == "earthquake"  # type
    assert result[8] == 0  # tsunami
    assert result[9] == 312  # sig
    assert result[10] == "green"  # alert
    assert result[11] == 12  # felt
    assert result[12] == "mb"  # mag_type
    assert result[13] == "us"  # net
    # result[14] is raw_data JSON string
    assert isinstance(result[14], str)
    assert "us7000abc1" in result[14]


# ---------------------------------------------------------------------------
# collect() tests (mocked HTTP)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_collect_parses_geojson(collector):
    """collect() fetches and parses GeoJSON features."""
    collector.fetch_json = AsyncMock(return_value=SAMPLE_GEOJSON)

    records = await collector.collect()

    assert len(records) == 2
    assert records[0]["event_id"] == "us7000abc1"
    assert records[1]["event_id"] == "ci12345678"
    collector.fetch_json.assert_awaited_once_with(
        collector.endpoint.replace("all_hour", "all_week")
    )


@pytest.mark.asyncio
async def test_collect_empty_features(collector):
    """collect() returns empty list for empty GeoJSON."""
    collector.fetch_json = AsyncMock(return_value=EMPTY_GEOJSON)

    records = await collector.collect()
    assert records == []


@pytest.mark.asyncio
async def test_collect_missing_features_key(collector):
    """collect() handles missing features key gracefully."""
    collector.fetch_json = AsyncMock(return_value={"type": "FeatureCollection"})

    records = await collector.collect()
    assert records == []


# ---------------------------------------------------------------------------
# store() integration (via base class executemany)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_store_calls_executemany(mock_pool):
    """store() calls executemany with formatted records."""
    pool, conn = mock_pool
    c = SeismicCollector(pool)

    records = [c._parse_feature(f) for f in SAMPLE_GEOJSON["features"]]
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
    c = SeismicCollector(pool)

    count = await c.store([])
    assert count == 0
    conn.executemany.assert_not_called()


# ---------------------------------------------------------------------------
# Full collect → format → store pipeline
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_full_pipeline(mock_pool):
    """End-to-end: collect → format_record → store."""
    pool, conn = mock_pool
    c = SeismicCollector(pool)
    c.fetch_json = AsyncMock(return_value=SAMPLE_GEOJSON)

    # Collect
    records = await c.collect()
    assert len(records) == 2

    # Format each record — should not raise
    for r in records:
        tup = c.format_record(r)
        assert len(tup) == 15

    # Store
    count = await c.store(records)
    assert count == 2
    conn.executemany.assert_called_once()


# ---------------------------------------------------------------------------
# Timestamp conversion tests
# ---------------------------------------------------------------------------


def test_timestamp_conversion(collector):
    """Unix ms timestamps convert to UTC datetime correctly."""
    feature = {
        "id": "test_ts",
        "properties": {
            "mag": 3.0,
            "time": 1700000000000,
            "type": "earthquake",
            "tsunami": 0,
            "sig": 50,
        },
        "geometry": {"coordinates": [10.0, 20.0, 5.0]},
    }
    record = collector._parse_feature(feature)

    expected = datetime(2023, 11, 14, 22, 13, 20, tzinfo=UTC)
    assert record["time"] == expected


def test_zero_timestamp(collector):
    """Unix epoch (0 ms) converts to 1970-01-01."""
    feature = {
        "id": "epoch",
        "properties": {"mag": 0.0, "time": 0, "type": "earthquake", "tsunami": 0, "sig": 0},
        "geometry": {"coordinates": [0.0, 0.0, 0.0]},
    }
    record = collector._parse_feature(feature)
    assert record["time"] == datetime(1970, 1, 1, tzinfo=UTC)
