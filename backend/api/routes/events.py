"""Tethys — Event Query Endpoints.

REST API for querying stored events across all domains.
All endpoints use /api/v1/ prefix for versioning.
"""

from fastapi import APIRouter, Query

from backend.db.connection import get_pool

router = APIRouter()


@router.get("/api/v1/events/seismic")
async def get_seismic_events(
    hours: int = Query(default=24, ge=1, le=168),
    min_mag: float = Query(default=0.0, ge=0),
    limit: int = Query(default=100, ge=1, le=1000),
):
    """Query seismic events."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT time, event_id, magnitude, latitude, longitude,
                   depth_km, place, type, tsunami, sig, alert, felt
            FROM seismic_events
            WHERE time > NOW() - make_interval(hours => $1)
              AND magnitude >= $2
            ORDER BY time DESC
            LIMIT $3
            """,
            hours,
            min_mag,
            limit,
        )
    return {
        "count": len(rows),
        "events": [dict(r) for r in rows],
    }


@router.get("/api/v1/solar-wind/latest")
async def get_solar_wind_latest():
    """Latest solar wind readings."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT time, source, density, speed, temperature,
                   bt, bx_gsm, by_gsm, bz_gsm, lon_gsm, lat_gsm
            FROM solar_wind
            ORDER BY time DESC
            LIMIT 1
            """
        )
    return dict(row) if row else {}


@router.get("/api/v1/goes/xray")
async def get_goes_xray(
    hours: int = Query(default=24, ge=1, le=168),
):
    """X-ray flux data."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT time, flux_type, energy_band, flux, satellite
            FROM goes_flux
            WHERE time > NOW() - make_interval(hours => $1)
              AND flux_type = 'xray'
            ORDER BY time DESC
            LIMIT 1000
            """,
            hours,
        )
    return {
        "count": len(rows),
        "readings": [dict(r) for r in rows],
    }


@router.get("/api/v1/space-weather")
async def get_space_weather(
    hours: int = Query(default=24, ge=1, le=168),
    event_type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
):
    """Query space weather events (CME, GST, FLR, IPS)."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        if event_type:
            rows = await conn.fetch(
                """
                SELECT time, event_id, event_type, source, speed,
                       latitude, longitude, description, link
                FROM space_weather_events
                WHERE time > NOW() - make_interval(hours => $1)
                  AND event_type = $2
                ORDER BY time DESC
                LIMIT $3
                """,
                hours,
                event_type,
                limit,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT time, event_id, event_type, source, speed,
                       latitude, longitude, description, link
                FROM space_weather_events
                WHERE time > NOW() - make_interval(hours => $1)
                ORDER BY time DESC
                LIMIT $2
                """,
                hours,
                limit,
            )
    return {
        "count": len(rows),
        "events": [dict(r) for r in rows],
    }


@router.get("/api/v1/volcanic")
async def get_volcanic_events(
    days: int = Query(default=30, ge=1, le=365),
):
    """Recent volcanic events."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT time, event_id, volcano_name, latitude, longitude,
                   elevation_m, event_type, vei, description, link
            FROM volcanic_events
            WHERE time > NOW() - make_interval(days => $1)
            ORDER BY time DESC
            """,
            days,
        )
    return {
        "count": len(rows),
        "events": [dict(r) for r in rows],
    }
