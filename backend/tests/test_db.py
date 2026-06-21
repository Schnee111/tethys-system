"""Tethys — Tests for database connection and schema."""

import asyncpg
import pytest

from backend.db.connection import close_pool, get_pool, init_pool
from backend.db.schema import create_tables


@pytest.fixture
async def db_pool():
    """Create a test database connection pool."""
    pool = await init_pool("postgresql://tethys:***@localhost:5433/tethys")
    yield pool
    await close_pool()


async def test_connection_pool_init(db_pool: asyncpg.Pool):
    """Pool initializes and returns a valid connection."""
    assert db_pool is not None
    async with db_pool.acquire() as conn:
        result = await conn.fetchval("SELECT 1")
        assert result == 1


async def test_get_pool_before_init():
    """get_pool() raises if pool not initialized."""
    import backend.db.connection as mod

    # Ensure pool is None
    old_pool = mod._pool
    mod._pool = None
    try:
        with pytest.raises(RuntimeError, match="not initialized"):
            await get_pool()
    finally:
        mod._pool = old_pool


async def test_create_tables(db_pool: asyncpg.Pool):
    """Schema creation is idempotent and all tables exist."""
    await create_tables(db_pool)

    expected_tables = [
        "seismic_events",
        "solar_wind",
        "goes_flux",
        "space_weather_events",
        "atmospheric_data",
        "volcanic_events",
        "collector_status",
        "raw_ingestion",
    ]

    async with db_pool.acquire() as conn:
        for table in expected_tables:
            exists = await conn.fetchval(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)",
                table,
            )
            assert exists, f"Table '{table}' does not exist"


async def test_hypertables_created(db_pool: asyncpg.Pool):
    """All tables are converted to TimescaleDB hypertables."""
    await create_tables(db_pool)

    async with db_pool.acquire() as conn:
        hypertables = await conn.fetch(
            "SELECT hypertable_name FROM timescaledb_information.hypertables"
        )
        names = {h["hypertable_name"] for h in hypertables}

    expected = {
        "seismic_events",
        "solar_wind",
        "goes_flux",
        "space_weather_events",
        "atmospheric_data",
        "volcanic_events",
        "collector_status",
        "raw_ingestion",
    }
    assert expected.issubset(names), f"Missing hypertables: {expected - names}"
