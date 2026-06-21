"""Tethys — Tests for VolcanicCollector."""

import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.collectors.volcanic import VolcanicCollector

# ---------------------------------------------------------------------------
# Fixtures — sample EONET API responses
# ---------------------------------------------------------------------------

SAMPLE_EONET_RESPONSE = {
    "title": "EONET Events",
    "description": "Natural events from EONET",
    "link": "https://eonet.gsfc.nasa.gov/api/v3/events?category=volcanoes&status=open",
    "events": [
        {
            "id": "EONET_20409",
            "title": "Telica Volcano, Nicaragua",
            "description": None,
            "link": "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_20409",
            "closed": None,
            "category": "Volcanoes",
            "sources": [
                {
                    "id": "SIVolcano",
                    "url": "https://volcano.si.edu/volcano.cfm?vn=344050",
                }
            ],
            "geometry": [
                {
                    "date": "2026-05-30T00:00:00Z",
                    "type": "Point",
                    "coordinates": [-86.84, 12.606],
                },
                {
                    "date": "2026-06-15T12:00:00Z",
                    "type": "Point",
                    "coordinates": [-86.845, 12.610],
                },
            ],
        },
        {
            "id": "EONET_20500",
            "title": "Kilauea Volcano, Hawaii",
            "description": "Ongoing eruption",
            "link": "https://eonet.gsfc.nasa.gov/api/v3/events/EONET_20500",
            "closed": None,
            "category": "Volcanoes",
            "sources": [
                {
                    "id": "SIVolcano",
                    "url": "https://volcano.si.edu/volcano.cfm?vn=332010",
                }
            ],
            "geometry": [
                {
                    "date": "2026-06-01T08:30:00Z",
                    "type": "Point",
                    "coordinates": [-155.2867, 19.4211],
                },
            ],
        },
        {
            "id": "EONET_99999",
            "title": "Closed Volcano Event",
            "closed": "2026-05-01T00:00:00Z",
            "sources": [],
            "geometry": [
                {
                    "date": "2026-04-01T00:00:00Z",
                    "type": "Point",
                    "coordinates": [0.0, 0.0],
                }
            ],
        },
    ],
}

EMPTY_EONET_RESPONSE = {
    "title": "EONET Events",
    "events": [],
}

EVENT_MINIMAL = {
    "id": "EONET_MINIMAL",
    "title": "Minimal Volcano",
    "sources": [],
    "geometry": [
        {
            "date": "2026-06-10T00:00:00Z",
            "type": "Point",
            "coordinates": [10.0, 20.0],
        }
    ],
    "closed": None,
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
    """VolcanicCollector with mock pool."""
    pool, _ = mock_pool
    return VolcanicCollector(pool)


# ---------------------------------------------------------------------------
# Class configuration tests
# ---------------------------------------------------------------------------


def test_collector_attributes(collector):
    """Collector has correct name, interval, endpoint."""
    assert collector.name == "volcanic"
    assert collector.poll_interval == 3600
    assert "eonet.gsfc.nasa.gov" in collector.endpoint
    assert "volcanoes" in collector.endpoint
    assert collector.timeout == 30
    assert "INSERT INTO volcanic_events" in collector.insert_query
    assert "ON CONFLICT" in collector.insert_query


# ---------------------------------------------------------------------------
# _parse_event tests
# ---------------------------------------------------------------------------


def test_parse_event_full(collector):
    """Parse a fully-populated EONET event."""
    event = SAMPLE_EONET_RESPONSE["events"][0]
    record = collector._parse_event(event)

    # Uses LAST geometry entry
    expected_time = datetime.fromisoformat("2026-06-15T12:00:00+00:00")
    assert record["time"] == expected_time
    assert record["event_id"] == "EONET_20409"
    assert record["volcano_name"] == "Telica Volcano, Nicaragua"
    # GeoJSON [lon, lat] → lat=12.610, lon=-86.845
    assert record["latitude"] == 12.610
    assert record["longitude"] == -86.845
    assert record["elevation_m"] is None
    assert record["event_type"] is None
    assert record["vei"] is None
    assert record["description"] == "Telica Volcano, Nicaragua"  # title fallback
    assert record["link"] == "https://volcano.si.edu/volcano.cfm?vn=344050"
    assert record["raw_data"] == event


def test_parse_event_single_geometry(collector):
    """Parse event with single geometry entry."""
    event = SAMPLE_EONET_RESPONSE["events"][1]
    record = collector._parse_event(event)

    expected_time = datetime.fromisoformat("2026-06-01T08:30:00+00:00")
    assert record["time"] == expected_time
    assert record["event_id"] == "EONET_20500"
    assert record["volcano_name"] == "Kilauea Volcano, Hawaii"
    assert record["latitude"] == 19.4211
    assert record["longitude"] == -155.2867
    assert record["description"] == "Ongoing eruption"  # explicit description


def test_parse_event_minimal(collector):
    """Parse event with minimal fields (no sources, no description)."""
    record = collector._parse_event(EVENT_MINIMAL)

    assert record["event_id"] == "EONET_MINIMAL"
    assert record["volcano_name"] == "Minimal Volcano"
    assert record["latitude"] == 20.0
    assert record["longitude"] == 10.0
    assert record["link"] is None
    assert record["description"] == "Minimal Volcano"  # title fallback


def test_coordinates_geojson_convention(collector):
    """Verify GeoJSON [longitude, latitude] ordering is handled correctly."""
    event = {
        "id": "COORD_TEST",
        "title": "Coord Test",
        "sources": [],
        "geometry": [
            {
                "date": "2026-01-01T00:00:00Z",
                "type": "Point",
                "coordinates": [-120.5, 35.2],  # [lon, lat]
            }
        ],
        "closed": None,
    }
    record = collector._parse_event(event)

    assert record["longitude"] == -120.5
    assert record["latitude"] == 35.2


def test_parse_event_uses_last_geometry(collector):
    """When multiple geometry entries exist, use the last one."""
    event = {
        "id": "MULTI_GEOM",
        "title": "Multi Geo",
        "sources": [],
        "geometry": [
            {
                "date": "2026-05-01T00:00:00Z",
                "type": "Point",
                "coordinates": [1.0, 2.0],
            },
            {
                "date": "2026-06-01T00:00:00Z",
                "type": "Point",
                "coordinates": [3.0, 4.0],
            },
        ],
        "closed": None,
    }
    record = collector._parse_event(event)

    assert record["longitude"] == 3.0
    assert record["latitude"] == 4.0
    assert record["time"] == datetime(2026, 6, 1, tzinfo=UTC)


# ---------------------------------------------------------------------------
# format_record tests
# ---------------------------------------------------------------------------


def test_format_record_tuple_length(collector):
    """format_record returns 11-element tuple matching INSERT placeholders."""
    event = SAMPLE_EONET_RESPONSE["events"][0]
    record = collector._parse_event(event)
    result = collector.format_record(record)

    assert isinstance(result, tuple)
    assert len(result) == 11


def test_format_record_values(collector):
    """format_record tuple values match expected order."""
    event = SAMPLE_EONET_RESPONSE["events"][0]
    record = collector._parse_event(event)
    result = collector.format_record(record)

    expected_time = datetime.fromisoformat("2026-06-15T12:00:00+00:00")
    assert result[0] == expected_time  # time
    assert result[1] == "EONET_20409"  # event_id
    assert result[2] == "Telica Volcano, Nicaragua"  # volcano_name
    assert result[3] == 12.610  # latitude
    assert result[4] == -86.845  # longitude
    assert result[5] is None  # elevation_m
    assert result[6] is None  # event_type
    assert result[7] is None  # vei
    assert result[8] == "Telica Volcano, Nicaragua"  # description
    assert result[9] == "https://volcano.si.edu/volcano.cfm?vn=344050"  # link
    # result[10] is raw_data JSON string
    assert isinstance(result[10], str)
    assert "EONET_20409" in result[10]


def test_format_record_raw_data_is_json(collector):
    """raw_data is serialized as JSON string."""
    event = SAMPLE_EONET_RESPONSE["events"][0]
    record = collector._parse_event(event)
    result = collector.format_record(record)

    raw = json.loads(result[10])
    assert raw["id"] == "EONET_20409"
    assert raw["title"] == "Telica Volcano, Nicaragua"


# ---------------------------------------------------------------------------
# collect() tests (mocked HTTP)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_collect_parses_events(collector):
    """collect() fetches and parses EONET events, filtering closed ones."""
    collector.fetch_json = AsyncMock(return_value=SAMPLE_EONET_RESPONSE)

    records = await collector.collect()

    # 3 events total, but 1 is closed → 2 active
    assert len(records) == 2
    assert records[0]["event_id"] == "EONET_20409"
    assert records[1]["event_id"] == "EONET_20500"
    collector.fetch_json.assert_awaited_once_with(collector.endpoint)


@pytest.mark.asyncio
async def test_collect_empty_events(collector):
    """collect() returns empty list for empty events array."""
    collector.fetch_json = AsyncMock(return_value=EMPTY_EONET_RESPONSE)

    records = await collector.collect()
    assert records == []


@pytest.mark.asyncio
async def test_collect_missing_events_key(collector):
    """collect() handles missing events key gracefully."""
    collector.fetch_json = AsyncMock(return_value={})

    records = await collector.collect()
    assert records == []


@pytest.mark.asyncio
async def test_collect_filters_closed_events(collector):
    """collect() only includes events where closed is None."""
    response = {
        "events": [
            {
                "id": "OPEN",
                "title": "Open",
                "closed": None,
                "sources": [],
                "geometry": [
                    {"date": "2026-06-01T00:00:00Z", "type": "Point", "coordinates": [0, 0]}
                ],
            },
            {
                "id": "CLOSED",
                "title": "Closed",
                "closed": "2026-05-01T00:00:00Z",
                "sources": [],
                "geometry": [
                    {"date": "2026-04-01T00:00:00Z", "type": "Point", "coordinates": [0, 0]}
                ],
            },
        ]
    }
    collector.fetch_json = AsyncMock(return_value=response)

    records = await collector.collect()
    assert len(records) == 1
    assert records[0]["event_id"] == "OPEN"


# ---------------------------------------------------------------------------
# store() integration (via base class executemany)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_store_calls_executemany(mock_pool):
    """store() calls executemany with formatted records."""
    pool, conn = mock_pool
    c = VolcanicCollector(pool)

    events = [e for e in SAMPLE_EONET_RESPONSE["events"] if e.get("closed") is None]
    records = [c._parse_event(e) for e in events]
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
    c = VolcanicCollector(pool)

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
    c = VolcanicCollector(pool)
    c.fetch_json = AsyncMock(return_value=SAMPLE_EONET_RESPONSE)

    # Collect — should filter closed event
    records = await c.collect()
    assert len(records) == 2

    # Format each record — should not raise
    for r in records:
        tup = c.format_record(r)
        assert len(tup) == 11

    # Store
    count = await c.store(records)
    assert count == 2
    conn.executemany.assert_called_once()


# ---------------------------------------------------------------------------
# Timestamp parsing tests
# ---------------------------------------------------------------------------


def test_iso_timestamp_parsing(collector):
    """ISO timestamps parse to UTC datetime correctly."""
    event = {
        "id": "TS_TEST",
        "title": "TS Test",
        "sources": [],
        "geometry": [{"date": "2026-03-15T14:30:00Z", "type": "Point", "coordinates": [0, 0]}],
        "closed": None,
    }
    record = collector._parse_event(event)

    expected = datetime(2026, 3, 15, 14, 30, 0, tzinfo=UTC)
    assert record["time"] == expected


def test_iso_timestamp_with_offset(collector):
    """ISO timestamps with timezone offset parse correctly."""
    event = {
        "id": "OFFSET_TEST",
        "title": "Offset Test",
        "sources": [],
        "geometry": [{"date": "2026-03-15T14:30:00+05:30", "type": "Point", "coordinates": [0, 0]}],
        "closed": None,
    }
    record = collector._parse_event(event)

    # Should preserve timezone info
    assert record["time"].tzinfo is not None
    assert record["time"].year == 2026
    assert record["time"].month == 3
    assert record["time"].day == 15
