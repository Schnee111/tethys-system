"""Tethys — Integration Tests.

End-to-end tests that verify the full pipeline:
database → API → response. Uses real DB, not mocks.
"""

from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient

from backend.api.main import app
from backend.db.connection import close_pool, init_pool


@pytest.fixture(autouse=True)
async def setup_db():
    """Initialize DB pool and ensure tables exist."""
    pool = await init_pool("postgresql://tethys:***@localhost:5433/tethys")
    from backend.db.schema import create_tables

    await create_tables(pool)
    yield pool
    await close_pool()


@pytest.fixture
async def client():
    """Create a test HTTP client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_seismic_flow(client, setup_db):
    """Insert seismic event → query via API → verify response."""
    pool = setup_db
    now = datetime.now(UTC)

    # Insert test data
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO seismic_events (time, event_id, magnitude, latitude, longitude, depth_km, place)
            VALUES ($1, 'test-001', 5.2, 35.68, 139.69, 35.0, 'Test Earthquake')
            """,
            now,
        )

    # Query via API
    resp = await client.get("/api/v1/events/seismic?hours=1&min_mag=0")
    assert resp.status_code == 200
    data = resp.json()
    assert data["count"] >= 1
    assert any(e["event_id"] == "test-001" for e in data["events"])

    # Cleanup
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM seismic_events WHERE event_id = 'test-001'")


async def test_solar_wind_flow(client, setup_db):
    """Insert solar wind → query latest → verify response."""
    pool = setup_db
    now = datetime.now(UTC)

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO solar_wind (time, source, density, speed, temperature, bt, bz_gsm)
            VALUES ($1, 'dscovr', 7.04, 378.8, 125000, 4.68, 0.51)
            """,
            now,
        )

    resp = await client.get("/api/v1/solar-wind/latest")
    assert resp.status_code == 200
    data = resp.json()
    assert data["density"] == pytest.approx(7.04)
    assert data["speed"] == pytest.approx(378.8)

    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM solar_wind WHERE source = 'dscovr'")


async def test_status_shows_tables(client):
    """Status endpoint shows all tables with counts."""
    resp = await client.get("/api/v1/status")
    assert resp.status_code == 200
    data = resp.json()
    tables = data["database"]["tables"]
    assert len(tables) == 6
    assert all(isinstance(v, int) for v in tables.values())


async def test_goes_xray_empty(client):
    """GOES xray endpoint returns empty when no data."""
    resp = await client.get("/api/v1/goes/xray?hours=1")
    assert resp.status_code == 200
    data = resp.json()
    assert "readings" in data
    assert isinstance(data["readings"], list)


async def test_space_weather_filter(client, setup_db):
    """Space weather endpoint filters by event_type."""
    pool = setup_db
    now = datetime.now(UTC)

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO space_weather_events (time, event_id, event_type, source, speed)
            VALUES ($1, 'test-cme-001', 'CME', 'S25W30', 1200)
            """,
            now,
        )
        await conn.execute(
            """
            INSERT INTO space_weather_events (time, event_id, event_type, source)
            VALUES ($1, 'test-gst-001', 'GST', NULL)
            """,
            now,
        )

    # Filter by CME
    resp = await client.get("/api/v1/space-weather?hours=1&event_type=CME")
    data = resp.json()
    assert all(e["event_type"] == "CME" for e in data["events"])

    # No filter
    resp = await client.get("/api/v1/space-weather?hours=1")
    data = resp.json()
    assert data["count"] >= 2

    # Cleanup
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM space_weather_events WHERE event_id LIKE 'test-%'")
