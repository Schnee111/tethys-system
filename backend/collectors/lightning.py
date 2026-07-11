"""Tethys — Lightning Data Collector.

Fetches lightning detection data from WWLLN (World Wide Lightning Location Network).
Lightning activity correlates with severe weather and atmospheric disturbances.
"""

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from backend.collectors.base import BaseCollector

logger = logging.getLogger(__name__)

# WWLLN API endpoint
WWLLN_ENDPOINT = "https://data.wwlln.net/api/v1/strikes"


class LightningCollector(BaseCollector):
    """Collects lightning strike data from WWLLN."""

    name = "lightning"
    poll_interval = 300  # 5 minutes
    endpoint = WWLLN_ENDPOINT
    timeout = 30

    insert_query = """
        INSERT INTO lightning_data (time, latitude, longitude, energy, stroke_count)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (time, latitude, longitude) DO NOTHING
    """

    def __init__(self, pool):
        super().__init__(pool)
        # Grid resolution for aggregation (0.5 degree cells)
        self.grid_resolution = 0.5

    async def collect(self) -> list[dict[str, Any]]:
        """Fetch lightning data from WWLLN API."""
        all_records = []

        try:
            # Get data from last 5 minutes
            end_time = datetime.now(UTC)
            start_time = end_time - timedelta(minutes=5)

            # Build URL with query parameters
            url = f"{self.endpoint}?start={start_time.isoformat()}&end={end_time.isoformat()}&format=json"

            data = await self.fetch_json(url)
            if isinstance(data, dict) and "strikes" in data:
                records = self._aggregate_strikes(data["strikes"])
                all_records.extend(records)
                logger.info(f"Fetched {len(data['strikes'])} strikes, aggregated to {len(records)} cells")

        except Exception as e:
            logger.error(f"Failed to fetch lightning data: {e}")

        return all_records

    def _aggregate_strikes(self, strikes: list[dict]) -> list[dict]:
        """Aggregate lightning strikes into grid cells."""
        grid_data = {}

        for strike in strikes:
            try:
                # Parse timestamp
                time_str = strike.get("time", "")
                time = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                if time.tzinfo is None:
                    time = time.replace(tzinfo=UTC)

                # Round to 5-minute interval
                time = time.replace(second=0, microsecond=0)
                minute = (time.minute // 5) * 5
                time = time.replace(minute=minute)

                # Get location
                lat = float(strike.get("latitude", 0))
                lon = float(strike.get("longitude", 0))

                # Get energy (if available)
                energy = float(strike.get("energy", 0))

                # Grid cell coordinates
                grid_lat = round(lat / self.grid_resolution) * self.grid_resolution
                grid_lon = round(lon / self.grid_resolution) * self.grid_resolution

                # Aggregate by grid cell and time
                key = (time, grid_lat, grid_lon)
                if key not in grid_data:
                    grid_data[key] = {
                        "time": time,
                        "latitude": grid_lat,
                        "longitude": grid_lon,
                        "energy": 0,
                        "stroke_count": 0
                    }

                grid_data[key]["energy"] += energy
                grid_data[key]["stroke_count"] += 1

            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse strike: {e}")
                continue

        return list(grid_data.values())

    def format_record(self, record: dict) -> tuple:
        """Convert record dict to tuple matching insert_query."""
        return (
            record["time"],
            record["latitude"],
            record["longitude"],
            record["energy"],
            record["stroke_count"],
        )
