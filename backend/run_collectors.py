"""Tethys — Collector Orchestrator.

Entry point for the tethys-collector.service.
Starts all 6 collectors as concurrent asyncio tasks.

CRITICAL: This runs in a SEPARATE service from the API server.
Uvicorn --workers 2 would fork the process, creating duplicate collectors
that double API calls and cause database deadlocks.
"""

import asyncio
import logging

from backend.analysis.scheduler import analysis_scheduler
from backend.collectors.atmospheric import AtmosphericCollector
from backend.collectors.donki import DONKICollector
from backend.collectors.goes_flux import GOESFluxCollector
from backend.collectors.seismic import SeismicCollector
from backend.collectors.solar_wind import SolarWindCollector
from backend.collectors.volcanic import VolcanicCollector
from backend.config import DATABASE_URL
from backend.db.connection import close_pool, init_pool
from backend.db.schema import create_tables

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def main() -> None:
    """Start all collectors."""
    logger.info("Tethys Collector Service starting...")

    pool = await init_pool(DATABASE_URL)
    await create_tables(pool)

    collectors = [
        SeismicCollector(pool),
        SolarWindCollector(pool),
        GOESFluxCollector(pool),
        DONKICollector(pool),
        AtmosphericCollector(pool),
        VolcanicCollector(pool),
    ]

    logger.info(f"Starting {len(collectors)} collectors + analysis scheduler...")
    tasks = [asyncio.create_task(c.run()) for c in collectors]
    tasks.append(asyncio.create_task(analysis_scheduler(pool)))

    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        logger.info("Collectors cancelled.")
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
