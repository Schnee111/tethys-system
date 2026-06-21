"""Tethys — Tests for BaseCollector."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.collectors.base import BaseCollector, set_broadcast_callback


class DummyCollector(BaseCollector):
    """Minimal concrete subclass for testing."""

    name = "test"
    poll_interval = 60
    endpoint = "https://example.com/api"
    insert_query = "INSERT INTO test (time, value) VALUES ($1, $2)"

    def __init__(self, pool, records=None):
        super().__init__(pool)
        self._records = records or []

    async def collect(self):
        return self._records

    def format_record(self, record):
        return (record["time"], record["value"])


@pytest.fixture
def mock_pool():
    """Create a mock asyncpg pool with working async context managers."""
    conn = AsyncMock()

    # conn.transaction() must be an async context manager
    transaction_ctx = AsyncMock()
    transaction_ctx.__aenter__ = AsyncMock(return_value=None)
    transaction_ctx.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=transaction_ctx)

    # pool.acquire() must be an async context manager
    acquire_ctx = AsyncMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=False)

    pool = AsyncMock()
    pool.acquire = MagicMock(return_value=acquire_ctx)

    return pool, conn


def test_base_collector_init(mock_pool):
    """Collector initializes with correct defaults."""
    pool, _ = mock_pool
    c = DummyCollector(pool)
    assert c.name == "test"
    assert c.poll_interval == 60
    assert c.last_poll_time is None
    assert c.total_records == 0
    assert c.last_status == "pending"


async def test_store_empty_records(mock_pool):
    """store() returns 0 for empty list, no DB call."""
    pool, conn = mock_pool
    c = DummyCollector(pool)
    result = await c.store([])
    assert result == 0
    conn.execute.assert_not_called()


async def test_store_with_records(mock_pool):
    """store() inserts records via executemany."""
    pool, conn = mock_pool
    c = DummyCollector(pool)
    records = [
        {"time": datetime.now(UTC), "value": 1.0},
        {"time": datetime.now(UTC), "value": 2.0},
    ]
    result = await c.store(records)
    assert result == 2
    conn.executemany.assert_called_once()


async def test_log_status(mock_pool):
    """log_status() inserts into collector_status table."""
    pool, conn = mock_pool
    c = DummyCollector(pool)
    await c.log_status("ok", 5, 1.23)
    assert c.last_status == "ok"
    assert c.total_records == 5
    conn.execute.assert_called_once()


async def test_broadcast_delta_filter(mock_pool):
    """broadcast_new_records() only sends records newer than last_poll_time."""
    pool, _ = mock_pool
    c = DummyCollector(pool)

    broadcast_calls = []

    async def mock_broadcast(event):
        broadcast_calls.append(event)

    set_broadcast_callback(mock_broadcast)

    # First run: no broadcast (sets last_poll_time, skips backfill)
    old_time = datetime(2020, 1, 1, tzinfo=UTC)
    await c.broadcast_new_records([{"time": old_time, "value": 1}])
    assert len(broadcast_calls) == 0
    assert c.last_poll_time is not None

    # Second run: only new records broadcast
    new_time = datetime(2099, 1, 1, tzinfo=UTC)
    await c.broadcast_new_records(
        [
            {"time": old_time, "value": 1},  # old — filtered out
            {"time": new_time, "value": 2},  # new — broadcast
        ]
    )
    assert len(broadcast_calls) == 1
    assert broadcast_calls[0]["count"] == 1

    # Cleanup
    set_broadcast_callback(None)


async def test_run_single_cycle(mock_pool):
    """run() calls collect → store → broadcast → log_status in one cycle."""
    pool, _conn = mock_pool
    now = datetime.now(UTC)
    c = DummyCollector(pool, records=[{"time": now, "value": 42}])

    call_count = 0

    async def mock_sleep(seconds):
        nonlocal call_count
        call_count += 1
        if call_count >= 1:
            raise KeyboardInterrupt("Stop loop")

    with patch("asyncio.sleep", side_effect=mock_sleep), pytest.raises(KeyboardInterrupt):
        await c.run()

    assert c.last_status == "ok"
    assert c.total_records == 1


async def test_run_exponential_backoff(mock_pool):
    """run() increases sleep time after consecutive errors."""
    pool, _conn = mock_pool
    c = DummyCollector(pool)
    c._records = []  # collect() returns empty — no error
    c.collect = AsyncMock(side_effect=Exception("API down"))

    sleep_times = []

    async def mock_sleep(seconds):
        sleep_times.append(seconds)
        if len(sleep_times) >= 3:
            raise KeyboardInterrupt("Stop")

    with patch("asyncio.sleep", side_effect=mock_sleep), pytest.raises(KeyboardInterrupt):
        await c.run()

    # First error: backoff = 2^1 * 10 = 20s (min with poll_interval=60)
    # Second error: backoff = 2^2 * 10 = 40s
    # Third error: backoff = 2^3 * 10 = 80s
    assert len(sleep_times) == 3
    assert sleep_times[1] > sleep_times[0]  # Increasing backoff
