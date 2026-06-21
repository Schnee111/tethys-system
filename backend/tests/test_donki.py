"""Tethys — Tests for DONKICollector."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.collectors.donki import (
    DONKICollector,
    _parse_source_location,
    _parse_timestamp,
)

# ---------------------------------------------------------------------------
# Sample API responses (one per event type)
# ---------------------------------------------------------------------------

SAMPLE_CME = [
    {
        "activityID": "CME-2024-01-15T12:00:00-CME-001",
        "startTime": "2024-01-15T12:00:00Z",
        "sourceLocation": "N22W15",
        "speed": 1200,
        "link": "https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/CME-2024-01-15T12:00:00-CME-001",
        "note": "Partial halo CME",
    },
    {
        "activityID": "CME-2024-01-16T06:30:00-CME-002",
        "startTime": "2024-01-16T06:30:00Z",
        "sourceLocation": None,
        "speed": None,
        "link": "https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/CME-2024-01-16T06:30:00-CME-002",
        "note": None,
    },
]

SAMPLE_GST = [
    {
        "activityID": "GST-2024-01-15T18:00:00-GST-001",
        "startTime": "2024-01-15T18:00:00Z",
        "sourceLocation": "S05E30",
        "speed": None,
        "link": "https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/GST-2024-01-15T18:00:00-GST-001",
        "message": "Kp=7 geomagnetic storm",
    },
]

SAMPLE_FLR = [
    {
        "activityID": "FLR-2024-01-14T09:15:00-FLR-001",
        "startTime": "2024-01-14T09:15:00Z",
        "sourceLocation": "N10E50",
        "speed": None,
        "link": "https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/FLR-2024-01-14T09:15:00-FLR-001",
        "note": "X2.1 class flare",
    },
]

SAMPLE_IPS = [
    {
        "activityID": "IPS-2024-01-13T22:00:00-IPS-001",
        "startTime": "2024-01-13T22:00:00Z",
        "sourceLocation": None,
        "speed": 800,
        "link": "https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/IPS-2024-01-13T22:00:00-IPS-001",
        "note": "Interplanetary shock detected",
    },
]

# Event with missing activityID (should be skipped)
BAD_EVENT = {
    "startTime": "2024-01-15T12:00:00Z",
    "sourceLocation": "N00",
}


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


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
    """DONKICollector with mock pool."""
    pool, _ = mock_pool
    return DONKICollector(pool)


# ---------------------------------------------------------------------------
# Class configuration tests
# ---------------------------------------------------------------------------


def test_collector_attributes(collector):
    """Collector has correct name, interval, endpoint."""
    assert collector.name == "donki"
    assert collector.poll_interval == 900
    assert collector.endpoint == "https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get"
    assert collector.timeout == 30
    assert "INSERT INTO space_weather_events" in collector.insert_query
    assert "ON CONFLICT" in collector.insert_query


# ---------------------------------------------------------------------------
# _parse_timestamp tests
# ---------------------------------------------------------------------------


def test_parse_timestamp_z_suffix():
    """ISO string with Z suffix parses correctly."""
    result = _parse_timestamp("2024-01-15T12:00:00Z")
    assert result == datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)


def test_parse_timestamp_no_z():
    """ISO string without Z suffix parses with UTC."""
    result = _parse_timestamp("2024-01-15T12:00:00")
    assert result == datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)


def test_parse_timestamp_with_offset():
    """ISO string with explicit +00:00 offset."""
    result = _parse_timestamp("2024-01-15T12:00:00+00:00")
    assert result == datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)


def test_parse_timestamp_none():
    """None input returns None."""
    assert _parse_timestamp(None) is None


def test_parse_timestamp_empty():
    """Empty string returns None."""
    assert _parse_timestamp("") is None


# ---------------------------------------------------------------------------
# _parse_source_location tests
# ---------------------------------------------------------------------------


def test_parse_source_location_north_west():
    """N22W15 → lat=22.0, lon=-15.0."""
    lat, lon = _parse_source_location("N22W15")
    assert lat == 22.0
    assert lon == -15.0


def test_parse_source_location_south_east():
    """S05E30 → lat=-5.0, lon=30.0."""
    lat, lon = _parse_source_location("S05E30")
    assert lat == -5.0
    assert lon == 30.0


def test_parse_source_location_three_digit_longitude():
    """N10E120 → lat=10.0, lon=120.0 (3-digit longitude)."""
    lat, lon = _parse_source_location("N10E120")
    assert lat == 10.0
    assert lon == 120.0


def test_parse_source_location_none():
    """None input returns (None, None)."""
    assert _parse_source_location(None) == (None, None)


def test_parse_source_location_empty():
    """Empty string returns (None, None)."""
    assert _parse_source_location("") == (None, None)


def test_parse_source_location_unparseable():
    """Unrecognised format returns (None, None)."""
    assert _parse_source_location("Solar") == (None, None)
    assert _parse_source_location("N00") == (None, None)


# ---------------------------------------------------------------------------
# _parse_event tests
# ---------------------------------------------------------------------------


def test_parse_cme_event(collector):
    """Parse a fully-populated CME event."""
    record = collector._parse_event(SAMPLE_CME[0], "CME")

    assert record is not None
    assert record["event_id"] == "CME-2024-01-15T12:00:00-CME-001"
    assert record["event_type"] == "CME"
    assert record["time"] == datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)
    assert record["source"] == "N22W15"
    assert record["speed"] == 1200.0
    assert record["latitude"] == 22.0
    assert record["longitude"] == -15.0
    assert record["description"] == "Partial halo CME"
    assert record["link"] is not None
    assert record["raw_data"] == SAMPLE_CME[0]


def test_parse_event_null_fields(collector):
    """Parse event with null source, speed, note."""
    record = collector._parse_event(SAMPLE_CME[1], "CME")

    assert record is not None
    assert record["source"] is None
    assert record["speed"] is None
    assert record["latitude"] is None
    assert record["longitude"] is None
    assert record["description"] is None


def test_parse_event_missing_activity_id(collector):
    """Event without activityID returns None."""
    result = collector._parse_event(BAD_EVENT, "CME")
    assert result is None


def test_parse_gst_event(collector):
    """GST events parse correctly."""
    record = collector._parse_event(SAMPLE_GST[0], "GST")
    assert record["event_type"] == "GST"
    assert record["latitude"] == -5.0
    assert record["longitude"] == 30.0
    assert record["description"] == "Kp=7 geomagnetic storm"


def test_parse_flr_event(collector):
    """FLR events parse correctly."""
    record = collector._parse_event(SAMPLE_FLR[0], "FLR")
    assert record["event_type"] == "FLR"
    assert record["latitude"] == 10.0
    assert record["longitude"] == 50.0
    assert record["description"] == "X2.1 class flare"


def test_parse_ips_event(collector):
    """IPS events parse correctly."""
    record = collector._parse_event(SAMPLE_IPS[0], "IPS")
    assert record["event_type"] == "IPS"
    assert record["speed"] == 800.0
    assert record["description"] == "Interplanetary shock detected"


# ---------------------------------------------------------------------------
# format_record tests
# ---------------------------------------------------------------------------


def test_format_record_tuple_length(collector):
    """format_record returns 10-element tuple matching INSERT placeholders."""
    record = collector._parse_event(SAMPLE_CME[0], "CME")
    result = collector.format_record(record)

    assert isinstance(result, tuple)
    assert len(result) == 10


def test_format_record_values(collector):
    """format_record tuple values match expected order."""
    record = collector._parse_event(SAMPLE_CME[0], "CME")
    result = collector.format_record(record)

    assert result[0] == datetime(2024, 1, 15, 12, 0, 0, tzinfo=UTC)  # time
    assert result[1] == "CME-2024-01-15T12:00:00-CME-001"  # event_id
    assert result[2] == "CME"  # event_type
    assert result[3] == "N22W15"  # source
    assert result[4] == 1200.0  # speed
    assert result[5] == 22.0  # latitude
    assert result[6] == -15.0  # longitude
    assert result[7] == "Partial halo CME"  # description
    assert "DONKI" in result[8]  # link
    # result[9] is raw_data JSON string
    assert isinstance(result[9], str)
    parsed_raw = json.loads(result[9])
    assert parsed_raw["activityID"] == "CME-2024-01-15T12:00:00-CME-001"


def test_format_record_null_fields(collector):
    """format_record handles nulls without raising."""
    record = collector._parse_event(SAMPLE_CME[1], "CME")
    result = collector.format_record(record)

    assert result[3] is None  # source
    assert result[4] is None  # speed
    assert result[5] is None  # latitude
    assert result[6] is None  # longitude
    assert result[7] is None  # description


# ---------------------------------------------------------------------------
# collect() tests (mocked HTTP)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_collect_all_types(collector):
    """collect() fetches all four event types and returns combined list."""
    responses = {
        "CME": SAMPLE_CME,
        "GST": SAMPLE_GST,
        "FLR": SAMPLE_FLR,
        "IPS": SAMPLE_IPS,
    }

    async def fake_fetch_json(url):
        for etype, data in responses.items():
            if f"/{etype}?" in url:
                return data
        return []

    collector.fetch_json = AsyncMock(side_effect=fake_fetch_json)

    records = await collector.collect()

    assert len(records) == 5  # 2 CME + 1 GST + 1 FLR + 1 IPS
    types = {r["event_type"] for r in records}
    assert types == {"CME", "GST", "FLR", "IPS"}
    assert collector.fetch_json.call_count == 4


@pytest.mark.asyncio
async def test_collect_empty_response(collector):
    """collect() returns empty list when all endpoints return empty."""
    collector.fetch_json = AsyncMock(return_value=[])
    records = await collector.collect()
    assert records == []


@pytest.mark.asyncio
async def test_collect_non_list_response(collector):
    """collect() skips non-list API responses gracefully."""
    collector.fetch_json = AsyncMock(return_value={"error": "bad request"})
    records = await collector.collect()
    assert records == []


@pytest.mark.asyncio
async def test_collect_partial_failure(collector):
    """collect() continues if one endpoint fails."""
    call_count = 0

    async def fake_fetch_json(url):
        nonlocal call_count
        call_count += 1
        if "/CME?" in url:
            raise Exception("CME endpoint down")
        if "/GST?" in url:
            return SAMPLE_GST
        return []

    collector.fetch_json = AsyncMock(side_effect=fake_fetch_json)

    records = await collector.collect()
    assert len(records) == 1
    assert records[0]["event_type"] == "GST"


@pytest.mark.asyncio
async def test_collect_skips_bad_events(collector):
    """collect() skips events without activityID."""

    async def fake_fetch_json(url):
        if "/CME?" in url:
            return [BAD_EVENT, SAMPLE_CME[0]]
        return []

    collector.fetch_json = AsyncMock(side_effect=fake_fetch_json)
    records = await collector.collect()
    assert len(records) == 1


@pytest.mark.asyncio
async def test_collect_non_list_body_skipped(collector):
    """collect() gracefully handles an endpoint returning a dict instead of list."""
    call_count = 0

    async def fake_fetch_json(url):
        nonlocal call_count
        call_count += 1
        if "/CME?" in url:
            return {"error": "not a list"}
        if "/GST?" in url:
            return SAMPLE_GST
        return []

    collector.fetch_json = AsyncMock(side_effect=fake_fetch_json)

    records = await collector.collect()
    assert len(records) == 1
    assert records[0]["event_type"] == "GST"


# ---------------------------------------------------------------------------
# store() integration
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_store_calls_executemany(mock_pool):
    """store() calls executemany with formatted records."""
    pool, conn = mock_pool
    c = DONKICollector(pool)

    records = [c._parse_event(SAMPLE_CME[0], "CME"), c._parse_event(SAMPLE_GST[0], "GST")]
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
    c = DONKICollector(pool)

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
    c = DONKICollector(pool)

    async def fake_fetch_json(url):
        if "/CME?" in url:
            return SAMPLE_CME
        return []

    c.fetch_json = AsyncMock(side_effect=fake_fetch_json)

    # Collect
    records = await c.collect()
    assert len(records) == 2

    # Format each record — should not raise
    for r in records:
        tup = c.format_record(r)
        assert len(tup) == 10

    # Store
    count = await c.store(records)
    assert count == 2
    conn.executemany.assert_called_once()
