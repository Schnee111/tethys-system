"""Tethys — Tests for SolarWindCollector."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from backend.collectors.solar_wind import (
    MAG_INSERT_QUERY,
    PLASMA_INSERT_QUERY,
    SolarWindCollector,
    _parse_noaa_response,
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
def sample_plasma_raw():
    """NOAA-format plasma response (array-of-arrays, header + 2 data rows)."""
    return [
        ["time_tag", "density", "speed", "temperature"],
        ["2025-06-20 12:00:00.000", "5.2", "400.1", "120000.5"],
        ["2025-06-20 12:05:00.000", "", "401.3", "125000"],  # empty density
    ]


@pytest.fixture
def sample_mag_raw():
    """NOAA-format magnetometer response."""
    return [
        ["time_tag", "bx_gsm", "by_gsm", "bz_gsm", "lon_gsm", "lat_gsm", "bt"],
        ["2025-06-20 12:00:00.000", "-2.1", "3.4", "-5.0", "120.3", "-45.2", "6.7"],
        ["2025-06-20 12:05:00.000", "-2.5", "null", "-4.8", "119.8", "-44.9", "6.2"],
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


# ---------------------------------------------------------------------------
# _parse_noaa_response tests
# ---------------------------------------------------------------------------


class TestParseNoaaResponse:
    def test_empty_input(self):
        assert _parse_noaa_response([], "plasma") == []

    def test_header_only(self):
        assert _parse_noaa_response([["a", "b"]], "plasma") == []

    def test_plasma_parsing(self, sample_plasma_raw):
        records = _parse_noaa_response(sample_plasma_raw, "plasma")
        assert len(records) == 2

        r0 = records[0]
        assert r0["data_type"] == "plasma"
        assert r0["time"] == datetime(2025, 6, 20, 12, 0, 0, tzinfo=UTC)
        assert r0["density"] == 5.2
        assert r0["speed"] == 400.1
        assert r0["temperature"] == 120000.5

        # Second row: density is empty → None
        r1 = records[1]
        assert r1["density"] is None
        assert r1["speed"] == 401.3

    def test_mag_parsing(self, sample_mag_raw):
        records = _parse_noaa_response(sample_mag_raw, "mag")
        assert len(records) == 2

        r0 = records[0]
        assert r0["data_type"] == "mag"
        assert r0["bx_gsm"] == -2.1
        assert r0["bt"] == 6.7

        # Second row: by_gsm is "null" → None
        r1 = records[1]
        assert r1["by_gsm"] is None
        assert r1["bz_gsm"] == -4.8

    def test_skips_row_without_time(self):
        raw = [
            ["time_tag", "density", "speed", "temperature"],
            ["", "5.2", "400", "120000"],  # empty time → skip
            ["2025-06-20 12:00:00.000", "6.0", "410", "130000"],
        ]
        records = _parse_noaa_response(raw, "plasma")
        assert len(records) == 1

    def test_short_row_padded(self):
        """Rows shorter than header should be padded with None."""
        raw = [
            ["time_tag", "density", "speed", "temperature"],
            ["2025-06-20 12:00:00.000", "5.2"],  # only 2 cols
        ]
        records = _parse_noaa_response(raw, "plasma")
        assert len(records) == 1
        assert records[0]["speed"] is None
        assert records[0]["temperature"] is None

    def test_time_with_z_suffix(self):
        raw = [
            ["time_tag", "density"],
            ["2025-06-20T12:00:00Z", "5.0"],
        ]
        records = _parse_noaa_response(raw, "plasma")
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
        assert c.insert_query == PLASMA_INSERT_QUERY

    async def test_collect_merges_both_feeds(self, mock_pool, sample_plasma_raw, sample_mag_raw):
        pool, _ = mock_pool
        c = SolarWindCollector(pool)

        async def mock_fetch(url):
            if "plasma" in url:
                return sample_plasma_raw
            return sample_mag_raw

        c.fetch_json = mock_fetch
        records = await c.collect()

        assert len(records) == 4  # 2 plasma + 2 mag
        plasma = [r for r in records if r["data_type"] == "plasma"]
        mag = [r for r in records if r["data_type"] == "mag"]
        assert len(plasma) == 2
        assert len(mag) == 2

    async def test_store_splits_by_type(self, mock_pool, sample_plasma_raw, sample_mag_raw):
        pool, conn = mock_pool
        c = SolarWindCollector(pool)

        plasma_records = _parse_noaa_response(sample_plasma_raw, "plasma")
        mag_records = _parse_noaa_response(sample_mag_raw, "mag")
        all_records = plasma_records + mag_records

        result = await c.store(all_records)

        assert result == 4
        # executemany should have been called twice (plasma + mag)
        assert conn.executemany.call_count == 2

        # Verify the correct queries were used
        calls = conn.executemany.call_args_list
        queries_used = [call.args[0] for call in calls]
        assert PLASMA_INSERT_QUERY in queries_used
        assert MAG_INSERT_QUERY in queries_used

    async def test_store_empty_returns_zero(self, mock_pool):
        pool, conn = mock_pool
        c = SolarWindCollector(pool)
        result = await c.store([])
        assert result == 0
        conn.executemany.assert_not_called()

    async def test_store_plasma_only(self, mock_pool, sample_plasma_raw):
        pool, conn = mock_pool
        c = SolarWindCollector(pool)

        records = _parse_noaa_response(sample_plasma_raw, "plasma")
        result = await c.store(records)

        assert result == 2
        # Only plasma query should be called (mag list is empty)
        assert conn.executemany.call_count == 1
        conn.executemany.assert_called_once_with(
            PLASMA_INSERT_QUERY,
            [
                (
                    datetime(2025, 6, 20, 12, 0, 0, tzinfo=UTC),
                    5.2,
                    400.1,
                    120000.5,
                ),
                (
                    datetime(2025, 6, 20, 12, 5, 0, tzinfo=UTC),
                    None,
                    401.3,
                    125000.0,
                ),
            ],
        )

    async def test_store_mag_only(self, mock_pool, sample_mag_raw):
        pool, conn = mock_pool
        c = SolarWindCollector(pool)

        records = _parse_noaa_response(sample_mag_raw, "mag")
        result = await c.store(records)

        assert result == 2
        assert conn.executemany.call_count == 1
        args = conn.executemany.call_args
        assert args.args[0] == MAG_INSERT_QUERY
        # First tuple: all fields present
        assert args.args[1][0] == (
            datetime(2025, 6, 20, 12, 0, 0, tzinfo=UTC),
            6.7,
            -2.1,
            3.4,
            -5.0,
            120.3,
            -45.2,
        )

    async def test_format_record_satisfies_abc(self, mock_pool):
        """format_record exists to satisfy the ABC contract."""
        pool, _ = mock_pool
        c = SolarWindCollector(pool)
        result = c.format_record(
            {
                "time": datetime.now(UTC),
                "density": 5.0,
                "speed": 400.0,
                "temperature": 100000.0,
            }
        )
        assert isinstance(result, tuple)
        assert len(result) == 4


# ---------------------------------------------------------------------------
# Real-world API shape simulation
# ---------------------------------------------------------------------------


class TestRealWorldShape:
    """Simulate the exact response format from NOAA SWPC."""

    async def test_full_plasma_cycle(self, mock_pool):
        """End-to-end: raw NOAA plasma JSON → parsed → stored."""
        pool, conn = mock_pool
        c = SolarWindCollector(pool)

        # Simulate real NOAA response
        raw_plasma = [
            ["time_tag", "density", "speed", "temperature"],
            ["2025-06-18 00:00:00.000", "3.51", "358.7", "47468.4"],
            ["2025-06-18 00:01:00.000", "3.57", "359.1", "48012.7"],
            ["2025-06-18 00:02:00.000", "", "", ""],  # all empty → all None
        ]

        raw_mag = [
            ["time_tag", "bx_gsm", "by_gsm", "bz_gsm", "lon_gsm", "lat_gsm", "bt"],
            ["2025-06-18 00:00:00.000", "-3.70", "0.20", "-2.80", "175.54", "-39.77", "4.65"],
        ]

        async def mock_fetch(url):
            return raw_plasma if "plasma" in url else raw_mag

        c.fetch_json = mock_fetch
        records = await c.collect()

        # 3 plasma + 1 mag = 4 total
        assert len(records) == 4

        plasma_records = [r for r in records if r["data_type"] == "plasma"]
        mag_records = [r for r in records if r["data_type"] == "mag"]
        assert len(plasma_records) == 3
        assert len(mag_records) == 1

        # The all-empty row should have all-None numeric fields
        empty_row = plasma_records[2]
        assert empty_row["density"] is None
        assert empty_row["speed"] is None
        assert empty_row["temperature"] is None

        # Store it
        result = await c.store(records)
        assert result == 4
        assert conn.executemany.call_count == 2
