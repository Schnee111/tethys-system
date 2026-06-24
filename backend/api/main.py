"""Tethys — FastAPI Application.

Main entry point for the Tethys API server.
Uses lifespan context manager (not deprecated on_event).
Embeds collectors as background tasks for real-time WebSocket broadcasting.
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes.analysis import router as analysis_router
from backend.api.routes.events import router as events_router
from backend.api.routes.websocket import broadcast_event, websocket_heartbeat
from backend.api.routes.websocket import router as ws_router
from backend.collectors.atmospheric import AtmosphericCollector
from backend.collectors.base import set_broadcast_callback
from backend.collectors.donki import DONKICollector
from backend.collectors.goes_flux import GOESFluxCollector
from backend.collectors.seismic import SeismicCollector
from backend.collectors.solar_wind import SolarWindCollector
from backend.collectors.volcanic import VolcanicCollector
from backend.config import DATABASE_URL, TETHYS_ENV
from backend.db.connection import close_pool, get_pool, init_pool
from backend.db.schema import create_tables

logger = logging.getLogger(__name__)

START_TIME = time.time()
TETHYS_VERSION = "0.1.0"

# CORS origins — specific origins only (wildcard + credentials violates CORS spec)
DEV_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

PROD_ORIGINS = [
    "https://tethys.pages.dev",
]

ALLOWED_ORIGINS = PROD_ORIGINS if TETHYS_ENV == "production" else DEV_ORIGINS


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    # Startup
    pool = await init_pool(DATABASE_URL)
    await create_tables(pool)

    # Wire WebSocket broadcast into collectors
    set_broadcast_callback(broadcast_event)

    # Start WebSocket heartbeat background task
    heartbeat_task = asyncio.create_task(websocket_heartbeat())

    # Start collectors as background tasks (same process = broadcast works)
    collectors = [
        SeismicCollector(pool),
        SolarWindCollector(pool),
        GOESFluxCollector(pool),
        DONKICollector(pool),
        AtmosphericCollector(pool),
        VolcanicCollector(pool),
    ]
    collector_tasks = [asyncio.create_task(c.run()) for c in collectors]
    logger.info(f"Started {len(collectors)} collectors in API server process")

    yield

    # Shutdown
    heartbeat_task.cancel()
    for task in collector_tasks:
        task.cancel()
    await asyncio.gather(heartbeat_task, *collector_tasks, return_exceptions=True)
    set_broadcast_callback(None)
    await close_pool()


app = FastAPI(
    title="Tethys — Planetary Intelligence System",
    version=TETHYS_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(events_router)
app.include_router(ws_router)
app.include_router(analysis_router)


@app.get("/api/v1/status")
async def get_status():
    """System health and collector status."""
    pool = await get_pool()

    async with pool.acquire() as conn:
        # Get collector statuses (latest per collector)
        rows = await conn.fetch("""
            SELECT DISTINCT ON (collector)
                collector, status, records_count, latency_ms, error_message, time
            FROM collector_status
            ORDER BY collector, time DESC
        """)

        # Get total record counts per table
        table_counts = {}
        for table in [
            "seismic_events",
            "solar_wind",
            "goes_flux",
            "space_weather_events",
            "atmospheric_data",
            "volcanic_events",
        ]:
            count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")  # noqa: S608
            table_counts[table] = count

        # Get database size
        db_size = await conn.fetchval("SELECT pg_size_pretty(pg_database_size(current_database()))")

    collectors = {}
    for row in rows:
        collectors[row["collector"]] = {
            "status": row["status"],
            "last_poll": row["time"].isoformat() if row["time"] else None,
            "records": row["records_count"],
            "latency_ms": round(row["latency_ms"], 1) if row["latency_ms"] else None,
            "error": row["error_message"],
        }

    return {
        "status": "operational",
        "version": TETHYS_VERSION,
        "uptime_seconds": round(time.time() - START_TIME),
        "environment": TETHYS_ENV,
        "collectors": collectors,
        "database": {
            "tables": table_counts,
            "total_records": sum(table_counts.values()),
            "size": db_size,
        },
    }


@app.get("/api/v1/health")
async def health_check():
    """Simple health check for load balancers."""
    return {"status": "ok"}


# Serve frontend static files (production mode)
import os
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

STATIC_DIR = Path(__file__).resolve().parent.parent.parent / "static"
if STATIC_DIR.is_dir():
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve frontend SPA — all non-API routes return index.html."""
        file_path = STATIC_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(STATIC_DIR / "index.html")
