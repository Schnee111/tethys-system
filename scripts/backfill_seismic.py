"""TETHYS — Historical Seismic Data Backfill Script.

Fetches historical earthquake data from USGS FDSN API and inserts into database.
Use this to backfill data older than what GeoJSON feeds provide.

Usage:
    # Backfill last 6 months
    python scripts/backfill_seismic.py --months 6
    
    # Backfill specific date range
    python scripts/backfill_seismic.py --start 2024-01-01 --end 2024-06-30
    
    # Backfill with minimum magnitude filter
    python scripts/backfill_seismic.py --months 3 --min-mag 2.5
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import aiohttp

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.config import DATABASE_URL
from backend.db.connection import close_pool, init_pool

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

# USGS FDSN API endpoint
FDSN_BASE_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"

INSERT_QUERY = """
    INSERT INTO seismic_events (
        time, event_id, magnitude, latitude, longitude, depth_km,
        place, type, tsunami, sig, alert, felt, mag_type, net, raw_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (time, event_id) DO NOTHING
"""


async def fetch_month(
    session: aiohttp.ClientSession,
    start_date: datetime,
    end_date: datetime,
    min_magnitude: float = 0.0,
) -> list[dict]:
    """Fetch seismic events for a specific date range."""
    params = {
        "format": "geojson",
        "starttime": start_date.strftime("%Y-%m-%d"),
        "endtime": end_date.strftime("%Y-%m-%d"),
        "minmagnitude": min_magnitude,
        "orderby": "time",
    }

    try:
        async with session.get(
            FDSN_BASE_URL, params=params, timeout=aiohttp.ClientTimeout(total=60)
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()

        features = data.get("features", [])
        logger.info(
            f"Fetched {len(features)} events from {start_date.date()} to {end_date.date()}"
        )
        return [_parse_feature(f) for f in features]

    except Exception as e:
        logger.error(f"Failed to fetch {start_date.date()} to {end_date.date()}: {e}")
        return []


def _parse_feature(feature: dict) -> dict:
    """Parse a single GeoJSON feature into a record dict."""
    props = feature.get("properties", {})
    coords = feature.get("geometry", {}).get("coordinates", [0, 0, 0])

    timestamp_ms = props.get("time", 0)

    return {
        "time": datetime.fromtimestamp(timestamp_ms / 1000, tz=UTC),
        "event_id": feature.get("id", ""),
        "magnitude": float(props.get("mag") or 0.0),
        "latitude": float(coords[1]) if len(coords) > 1 else 0.0,
        "longitude": float(coords[0]) if len(coords) > 0 else 0.0,
        "depth_km": float(coords[2]) if len(coords) > 2 else None,
        "place": props.get("place"),
        "type": props.get("type", "earthquake"),
        "tsunami": int(props.get("tsunami") or 0),
        "sig": props.get("sig"),
        "alert": props.get("alert"),
        "felt": props.get("felt"),
        "cdi": props.get("cdi"),
        "mmi": props.get("mmi"),
        "mag_type": props.get("magType"),
        "net": props.get("net"),
        "raw_data": feature,
    }


def format_record(record: dict) -> tuple:
    """Convert record dict to tuple for INSERT query."""
    return (
        record["time"],
        record["event_id"],
        record["magnitude"],
        record["latitude"],
        record["longitude"],
        record["depth_km"],
        record["place"],
        record["type"],
        record["tsunami"],
        record["sig"],
        record["alert"],
        record["felt"],
        record["mag_type"],
        record["net"],
        json.dumps(record["raw_data"]),
    )


async def backfill(
    start_date: datetime,
    end_date: datetime,
    min_magnitude: float = 0.0,
    chunk_days: int = 30,
    db_url: str | None = None,
) -> int:
    """Backfill seismic data for a date range."""
    pool = await init_pool(db_url or DATABASE_URL)
    total_inserted = 0

    try:
        async with aiohttp.ClientSession() as session:
            current = start_date
            while current < end_date:
                chunk_end = min(current + timedelta(days=chunk_days), end_date)

                logger.info(f"Processing {current.date()} to {chunk_end.date()}...")

                records = await fetch_month(session, current, chunk_end, min_magnitude)

                if records:
                    valid = [r for r in records if r.get("time") is not None]
                    if valid:
                        async with pool.acquire() as conn, conn.transaction():
                            values = [format_record(r) for r in valid]
                            result = await conn.executemany(INSERT_QUERY, values)
                            inserted = len(values)
                            total_inserted += inserted
                            logger.info(f"Inserted {inserted} records")

                current = chunk_end + timedelta(days=1)

                # Rate limiting: wait 1 second between chunks
                await asyncio.sleep(1)

        logger.info(f"Backfill complete. Total inserted: {total_inserted}")
        return total_inserted

    finally:
        await close_pool()


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Backfill historical seismic data from USGS FDSN API"
    )

    parser.add_argument(
        "--months",
        type=int,
        help="Backfill last N months (e.g., --months 6)",
    )

    parser.add_argument(
        "--start",
        type=str,
        help="Start date in YYYY-MM-DD format",
    )

    parser.add_argument(
        "--end",
        type=str,
        help="End date in YYYY-MM-DD format",
    )

    parser.add_argument(
        "--min-mag",
        type=float,
        default=0.0,
        help="Minimum magnitude filter (default: 0.0)",
    )

    parser.add_argument(
        "--chunk-days",
        type=int,
        default=30,
        help="Days per API request chunk (default: 30)",
    )

    return parser.parse_args()


def main():
    """Main entry point."""
    args = parse_args()

    # Determine date range
    if args.months:
        end_date = datetime.now(UTC)
        start_date = end_date - timedelta(days=args.months * 30)
    elif args.start and args.end:
        start_date = datetime.strptime(args.start, "%Y-%m-%d").replace(tzinfo=UTC)
        end_date = datetime.strptime(args.end, "%Y-%m-%d").replace(tzinfo=UTC)
    else:
        logger.error("Either --months or (--start and --end) must be provided")
        sys.exit(1)

    # Override DATABASE_URL if provided as environment variable
    import os
    db_url = os.environ.get("DATABASE_URL", DATABASE_URL)
    logger.info(f"Connecting to database: {db_url.split('@')[1] if '@' in db_url else 'localhost'}")

    logger.info(f"Backfilling seismic data from {start_date.date()} to {end_date.date()}")
    logger.info(f"Minimum magnitude: {args.min_mag}")

    # Run backfill
    inserted = asyncio.run(
        backfill(
            start_date=start_date,
            end_date=end_date,
            min_magnitude=args.min_mag,
            chunk_days=args.chunk_days,
            db_url=db_url,
        )
    )

    logger.info(f"Done! Inserted {inserted} records")


if __name__ == "__main__":
    main()
