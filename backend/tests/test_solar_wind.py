"""Tethys — Tests for SolarWindCollector (combined endpoint)."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.collectors.solar_wind import (
    COMBINED_INSERT_QUERY,
    SolarWindCollector,
    _parse_combined_response,
    _safe_float,
)

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
def sample_combined_raw():
    """NOAA geospace combined response (plasma + mag in one file)."""
    return [
        ["time_tag", "speed", "density", "temperature", "bx", "by", "bz", "bt", "vx", "vy", "vz", "propagated_time_tag"],
        ["2025-06-20T12:00:00Z", "400.1", "5.2", "120000.5", "-2.1", "3.4", "-5.0", "6.7", "-370.0", "40.0", "-45.0", "2025-06-20T12:55:00Z"],
        ["2025-06-20T12:05:00Z", "401.3", "", "125000", "-2.5", "null", "-4.8", "6.2", "-371.0", "41.0", "-44.0", "2025-06-20T13:00:00Z"],
    ]


# ---------------------------------------------------------------------------
# _safe_float tests
# ---------------------------------------------------------------------------


class TestSafeFloat:
    def test_normal_value(self):
        assert _safe_float("5.2") == 5.2

    def test_negative(self):
        assert _safe_float("-2.1") == -2.1

    def test_integer_string(self):
        assert _safe_float("400") == 400.0

    def test_none(self):
        assert _safe_float(None) is None

    def test_empty_string(self):
        assert _safe_float("") is None

    def test_null_string(self):
        assert _safe_float("null") is None

    def test_nan_string(self):
        assert _safe_float("NaN") is None

    def test_whitespace(self):
        assert _safe_float("  3.14  ") == 3.14

    def test_non_numeric(self):
        assert _safe_float("abc") is None

    def test_numeric_input(self):
        assert _safe_float(5.2) == 5.2


# ---------------------------------------------------------------------------
# _parse_combined_response tests
# ---------------------------------------------------------------------------


class TestParseCombinedResponse:
    def test_empty_input(self):
        assert _parse_combined_response([]) == []

    def test_header_only(self):
        assert _parse_combined_response([["a", "b"]]) == []

    def test_combined_parsing(self, sample_combined_raw):
        records = _parse_combined_response(sample_combined_raw)
        assert len(records) == 2

        r0 = records[0]
        assert r0["time"] == datetime(2025, 6, 20, 12, 0, 0, tzinfo=UTC)
        assert r0["speed"] == 400.1
        assert r0["density"] == 5.2
        assert r0["temperature"] == 120000.5
        assert r0["bx_gsm"] == -2.1
        assert r0["by_gsm"] == 3.4
        assert r0["bz_gsm"] == -5.0
        assert r0["bt"] == 6.7

        # Second row: density is empty → None, by_gsm is "null" → None
        r1 = records[1]
        assert r1["density"] is None
        assert r1["speed"] == 401.3
        assert r1["by_gsm"] is None
        assert r1["bz_gsm"] == -4.8

    def test_skips_row_without_time(self):
        raw = [
            ["time_tag", "speed", "density"],
            ["", "400", "5.2"],  # empty time → skip
            ["2025-06-20T12:00:00Z", "410", "6.0"],
        ]
        records = _parse_combined_response(raw)
        assert len(records) == 1

    def test_short_row_padded(self):
        """Rows shorter than header should be padded with None."""
        raw = [
            ["time_tag", "speed", "density", "temperature"],
            ["2025-06-20T12:00:00Z", "400.1"],  # only 2 cols
        ]
        records = _parse_combined_response(raw)
        assert len(records) == 1
        assert records[0]["density"] is None
        assert records[0]["temperature"] is None

    def test_time_with_space_separator(self):
        raw = [
            ["time_tag", "speed"],
            ["2025-06-20 12:00:00.000", "400.0"],
        ]
        records = _parse_combined_response(raw)
        assert records[0]["time"] == datetime(2025, 6, 20, 12, 0, 0, tzinfo=UTC)


# ---------------------------------------------------------------------------
# SolarWindCollector integration tests
# ---------------------------------------------------------------------------


class TestSolarWindCollector:
    def test_class_defaults(self, mock_pool):
        pool, _ = mock_pool
        c = SolarWindCollector(pool)
        assert c.name == "solar_wind"
        assert c.poll_interval == 300
        assert c.insert_query == COMBINED_INSERT_QUERY

    async def test_collect_combined_feed(self, mock_pool, sample_combined_raw):
        pool, _ = mock_pool
        c = SolarWindCollector(pool)

        async def mock_fetch(url):
            return sample_combined_raw

        c.fetch_json = mock_fetch
        records = await c.collect()

        assert len(records) == 2
        # Combined format — no data_type field
        assert "speed" in records[0]
        assert "bx_gsm" in records[0]

    async def test_store_combined(self, mock_pool, sample_combined_raw):
        pool, conn = mock_pool
        c = SolarWindCollector(pool)

        records = _parse_combined_response(sample_combined_raw)
        result = await c.store(records)

        assert result == 2
        # Single combined query
        assert conn.executemany.call_count == 1
        calls = conn.executemany.call_args_list
        assert calls[0].args[0] == COMBINED_INSERT_QUERY

    async def test_store_empty_returns_zero(self, mock_pool):
        pool, conn = mock_pool
        c = SolarWindCollector(pool)
        result = await c.store([])
        assert result == 0
        conn.executemany.assert_not_called()

    async def test_store_filters_null_time(self, mock_pool):
        pool, conn = mock_pool
        c = SolarWindCollector(pool)

        records = [
            {"time": datetime(2025, 6, 20, 12, 0, 0, tzinfo=UTC), "speed": 400.0, "density": 5.0, "temperature": 120000.0, "bx_gsm": -2.0, "by_gsm": 3.0, "bz_gsm": -5.0, "bt": 6.0},
            {"time": None, "speed": 410.0},  # NULL time → filtered
        ]
        result = await c.store(records)
        assert result == 1

    async def test_format_record(self, mock_pool):
        pool, _ = mock_pool
        c = SolarWindCollector(pool)

        record = {
            "time": datetime(2025, 6, 20, 12, 0, 0, tzinfo=UTC),
            "speed": 400.1,
            "density": 5.2,
            "temperature": 120000.5,
            "bt": 6.7,
            "bx_gsm": -2.1,
            "by_gsm": 3.4,
            "bz_gsm": -5.0,
        }
        t = c.format_record(record)
        assert t == (
            datetime(2025, 6, 20, 12, 0, 0, tzinfo=UTC),
            400.1,
            5.2,
            120000.5,
            6.7,
            -2.1,
            3.4,
            -5.0,
        )
