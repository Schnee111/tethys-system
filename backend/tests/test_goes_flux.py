"""Tethys — Tests for GOESFluxCollector."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.collectors.goes_flux import (
    PROTON_ENDPOINT,
    XRAY_ENDPOINT,
    GOESFluxCollector,
)

# ── Fixtures ──────────────────────────────────────────────────────────────


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


def _make_xray_sample():
    """Sample X-ray API response."""
    return [
        {
            "time_tag": "2026-06-21T10:00:00Z",
            "flux": "1.23e-6",
            "energy": "0.1-0.8nm",
            "satellite_tag": "goes-primary",
        },
        {
            "time_tag": "2026-06-21T10:01:00Z",
            "flux": "4.56e-7",
            "energy": "0.1-0.8nm",
            "satellite_tag": "goes-primary",
        },
        {
            "time_tag": "2026-06-21T10:00:00Z",
            "flux": "7.89e-8",
            "energy": "1.0-8.0nm",
            "satellite_tag": "goes-primary",
        },
    ]


def _make_proton_sample():
    """Sample Proton API response."""
    return [
        {
            "time_tag": "2026-06-21T10:00:00Z",
            "flux": "5.0",
            "energy": ">=1 MeV",
            "satellite_tag": "goes-primary",
        },
        {
            "time_tag": "2026-06-21T10:05:00Z",
            "flux": "3.14",
            "energy": ">=10 MeV",
            "satellite_tag": "goes-primary",
        },
    ]


# ── Initialization ────────────────────────────────────────────────────────


def test_collector_init(mock_pool):
    """Collector initializes with correct defaults."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)
    assert c.name == "goes_flux"
    assert c.poll_interval == 60
    assert c.last_poll_time is None
    assert c.insert_query.strip().startswith("INSERT INTO goes_flux")


# ── format_record ─────────────────────────────────────────────────────────


def test_format_record(mock_pool):
    """format_record returns correct tuple."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)
    record = {
        "time": datetime(2026, 6, 21, 10, 0, tzinfo=UTC),
        "flux_type": "xray",
        "energy_band": "0.1-0.8nm",
        "flux": 1.23e-6,
        "satellite": "goes-primary",
    }
    result = c.format_record(record)
    assert result == (
        datetime(2026, 6, 21, 10, 0, tzinfo=UTC),
        "xray",
        "0.1-0.8nm",
        1.23e-6,
        "goes-primary",
    )


# ── collect: successful fetch ─────────────────────────────────────────────


async def test_collect_both_endpoints(mock_pool):
    """collect() fetches both xray and proton endpoints and merges results."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)

    call_urls = []

    async def mock_fetch_json(url):
        call_urls.append(url)
        if "xrays" in url:
            return _make_xray_sample()
        return _make_proton_sample()

    c.fetch_json = mock_fetch_json

    records = await c.collect()

    assert len(call_urls) == 2
    assert XRAY_ENDPOINT in call_urls
    assert PROTON_ENDPOINT in call_urls

    # 3 xray + 2 proton = 5
    assert len(records) == 5

    # Check xray records
    xray_records = [r for r in records if r["flux_type"] == "xray"]
    assert len(xray_records) == 3

    # Check proton records
    proton_records = [r for r in records if r["flux_type"] == "proton"]
    assert len(proton_records) == 2


async def test_collect_parses_flux_as_float(mock_pool):
    """collect() correctly parses string flux values to float."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)

    async def mock_fetch_json(url):
        if "xrays" in url:
            return [
                {
                    "time_tag": "2026-06-21T10:00:00Z",
                    "flux": "1.23e-6",
                    "energy": "0.1-0.8nm",
                    "satellite_tag": "goes-primary",
                }
            ]
        return []

    c.fetch_json = mock_fetch_json
    records = await c.collect()

    assert len(records) == 1
    assert records[0]["flux"] == pytest.approx(1.23e-6)
    assert isinstance(records[0]["flux"], float)


async def test_collect_parses_time_tag(mock_pool):
    """collect() correctly parses ISO time_tag strings to datetime."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)

    async def mock_fetch_json(url):
        if "xrays" in url:
            return [
                {
                    "time_tag": "2026-06-21T14:30:00Z",
                    "flux": "2.5e-7",
                    "energy": "0.1-0.8nm",
                    "satellite_tag": "goes-primary",
                }
            ]
        return []

    c.fetch_json = mock_fetch_json
    records = await c.collect()

    assert len(records) == 1
    dt = records[0]["time"]
    assert isinstance(dt, datetime)
    assert dt.year == 2026
    assert dt.month == 6
    assert dt.day == 21
    assert dt.hour == 14
    assert dt.minute == 30


async def test_collect_maps_energy_to_energy_band(mock_pool):
    """collect() maps energy field directly to energy_band."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)

    async def mock_fetch_json(url):
        if "protons" in url:
            return [
                {
                    "time_tag": "2026-06-21T10:00:00Z",
                    "flux": "5.0",
                    "energy": ">=1 MeV",
                    "satellite_tag": "goes-primary",
                },
                {
                    "time_tag": "2026-06-21T10:05:00Z",
                    "flux": "3.14",
                    "energy": ">=10 MeV",
                    "satellite_tag": "goes-primary",
                },
            ]
        return []

    c.fetch_json = mock_fetch_json
    records = await c.collect()

    bands = {r["energy_band"] for r in records}
    assert ">=1 MeV" in bands
    assert ">=10 MeV" in bands


# ── collect: delta filter ─────────────────────────────────────────────────


async def test_collect_filters_by_last_poll_time(mock_pool):
    """collect() only returns records newer than last_poll_time."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)

    # Set last_poll_time to after first xray record
    c.last_poll_time = datetime(2026, 6, 21, 10, 0, 30, tzinfo=UTC)

    async def mock_fetch_json(url):
        if "xrays" in url:
            return [
                {
                    "time_tag": "2026-06-21T10:00:00Z",  # before last_poll
                    "flux": "1.0e-6",
                    "energy": "0.1-0.8nm",
                    "satellite_tag": "goes-primary",
                },
                {
                    "time_tag": "2026-06-21T10:01:00Z",  # after last_poll
                    "flux": "2.0e-6",
                    "energy": "0.1-0.8nm",
                    "satellite_tag": "goes-primary",
                },
            ]
        return []

    c.fetch_json = mock_fetch_json
    records = await c.collect()

    # Only the second record should pass the filter
    assert len(records) == 1
    assert records[0]["flux"] == pytest.approx(2.0e-6)


async def test_collect_first_run_returns_all(mock_pool):
    """collect() returns all records on first run (no last_poll_time)."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)

    async def mock_fetch_json(url):
        if "xrays" in url:
            return _make_xray_sample()
        return _make_proton_sample()

    c.fetch_json = mock_fetch_json
    records = await c.collect()

    assert len(records) == 5
    assert c.last_poll_time is None  # Not set by collect()


# ── collect: error handling ───────────────────────────────────────────────


async def test_collect_handles_fetch_error(mock_pool):
    """collect() handles endpoint fetch failures gracefully."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)

    async def mock_fetch_json(url):
        if "xrays" in url:
            raise Exception("Connection timeout")
        return _make_proton_sample()

    c.fetch_json = mock_fetch_json
    records = await c.collect()

    # Should still return proton records
    assert len(records) == 2
    assert all(r["flux_type"] == "proton" for r in records)


async def test_collect_handles_malformed_records(mock_pool):
    """collect() skips malformed records without crashing."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)

    async def mock_fetch_json(url):
        if "xrays" in url:
            return [
                {
                    "time_tag": "2026-06-21T10:00:00Z",
                    "flux": "1.0e-6",
                    "energy": "0.1-0.8nm",
                    "satellite_tag": "goes-primary",
                },
                {
                    # Missing flux — should be skipped
                    "time_tag": "2026-06-21T10:01:00Z",
                    "energy": "0.1-0.8nm",
                    "satellite_tag": "goes-primary",
                },
                {
                    "time_tag": "2026-06-21T10:02:00Z",
                    "flux": "not-a-number",  # Bad flux — should be skipped
                    "energy": "0.1-0.8nm",
                    "satellite_tag": "goes-primary",
                },
                {
                    "time_tag": "bad-date",  # Bad date — should be skipped
                    "flux": "2.0e-6",
                    "energy": "0.1-0.8nm",
                    "satellite_tag": "goes-primary",
                },
            ]
        return []

    c.fetch_json = mock_fetch_json
    records = await c.collect()

    # Only the first record should be valid
    assert len(records) == 1
    assert records[0]["flux"] == pytest.approx(1.0e-6)


# ── collect: satellite_tag handling ───────────────────────────────────────


async def test_collect_default_satellite(mock_pool):
    """collect() defaults satellite to 'goes-primary' when satellite_tag missing."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)

    async def mock_fetch_json(url):
        if "xrays" in url:
            return [
                {
                    "time_tag": "2026-06-21T10:00:00Z",
                    "flux": "1.0e-6",
                    "energy": "0.1-0.8nm",
                    # No satellite_tag
                }
            ]
        return []

    c.fetch_json = mock_fetch_json
    records = await c.collect()

    assert len(records) == 1
    assert records[0]["satellite"] == "goes-primary"


async def test_collect_preserves_satellite_tag(mock_pool):
    """collect() preserves satellite_tag when present."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)

    async def mock_fetch_json(url):
        if "xrays" in url:
            return [
                {
                    "time_tag": "2026-06-21T10:00:00Z",
                    "flux": "1.0e-6",
                    "energy": "0.1-0.8nm",
                    "satellite_tag": "goes-18",
                }
            ]
        return []

    c.fetch_json = mock_fetch_json
    records = await c.collect()

    assert len(records) == 1
    assert records[0]["satellite"] == "goes-18"


# ── store integration ─────────────────────────────────────────────────────


async def test_store_calls_executemany(mock_pool):
    """store() inserts records via executemany with correct query."""
    pool, conn = mock_pool
    c = GOESFluxCollector(pool)

    records = [
        {
            "time": datetime(2026, 6, 21, 10, 0, tzinfo=UTC),
            "flux_type": "xray",
            "energy_band": "0.1-0.8nm",
            "flux": 1.23e-6,
            "satellite": "goes-primary",
        },
        {
            "time": datetime(2026, 6, 21, 10, 0, tzinfo=UTC),
            "flux_type": "proton",
            "energy_band": ">=1 MeV",
            "flux": 5.0,
            "satellite": "goes-primary",
        },
    ]

    result = await c.store(records)
    assert result == 2
    conn.executemany.assert_called_once()

    # Verify the query and values
    call_args = conn.executemany.call_args
    assert call_args[0][0].strip().startswith("INSERT INTO goes_flux")
    assert len(call_args[0][1]) == 2


# ── empty response handling ───────────────────────────────────────────────


async def test_collect_empty_responses(mock_pool):
    """collect() handles empty API responses."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)

    async def mock_fetch_json(url):
        return []

    c.fetch_json = mock_fetch_json
    records = await c.collect()
    assert records == []


async def test_collect_empty_after_delta_filter(mock_pool):
    """collect() returns empty when all records are older than last_poll_time."""
    pool, _ = mock_pool
    c = GOESFluxCollector(pool)
    c.last_poll_time = datetime(2099, 1, 1, tzinfo=UTC)

    async def mock_fetch_json(url):
        if "xrays" in url:
            return _make_xray_sample()
        return _make_proton_sample()

    c.fetch_json = mock_fetch_json
    records = await c.collect()
    assert records == []
