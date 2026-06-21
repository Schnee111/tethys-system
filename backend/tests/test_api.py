"""Tethys — Tests for FastAPI application."""

import pytest
from httpx import ASGITransport, AsyncClient

from backend.api.main import app
from backend.db.connection import close_pool, init_pool


@pytest.fixture(autouse=True)
async def setup_db():
    """Initialize DB pool for tests that need it."""
    await init_pool("postgresql://tethys:***@localhost:5433/tethys")
    yield
    await close_pool()


@pytest.fixture
async def client():
    """Create a test HTTP client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_health_check(client):
    """GET /api/v1/health returns ok."""
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_status_returns_operational(client):
    """GET /api/v1/status returns operational status."""
    resp = await client.get("/api/v1/status")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "operational"
    assert data["version"] == "0.1.0"
    assert "uptime_seconds" in data
    assert data["uptime_seconds"] >= 0


async def test_status_has_database_info(client):
    """Status endpoint includes database metrics."""
    resp = await client.get("/api/v1/status")
    data = resp.json()
    assert "database" in data
    assert "tables" in data["database"]
    assert "total_records" in data["database"]
    assert "size" in data["database"]


async def test_status_has_collectors(client):
    """Status endpoint includes collector info."""
    resp = await client.get("/api/v1/status")
    data = resp.json()
    assert "collectors" in data
    assert isinstance(data["collectors"], dict)


async def test_status_has_environment(client):
    """Status endpoint includes environment."""
    resp = await client.get("/api/v1/status")
    data = resp.json()
    assert "environment" in data


async def test_status_database_tables(client):
    """Status shows all 6 data tables."""
    resp = await client.get("/api/v1/status")
    tables = resp.json()["database"]["tables"]
    expected = [
        "seismic_events",
        "solar_wind",
        "goes_flux",
        "space_weather_events",
        "atmospheric_data",
        "volcanic_events",
    ]
    for table in expected:
        assert table in tables
        assert isinstance(tables[table], int)
