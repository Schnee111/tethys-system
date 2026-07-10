"""Tethys — Cosmic Ray Collector.

Fetches cosmic ray neutron monitor data from NMDB (Neutron Monitor Database).
Cosmic ray variations are important for understanding space weather and
potential earthquake precursors (Forbush decreases).
"""

import logging
from datetime import UTC, datetime
from typing import Any

from backend.collectors.base import BaseCollector

logger = logging.getLogger(__name__)

# NMDB endpoint for Oulu neutron monitor (primary station)
NMDB_ENDPOINT = "http://nmdb.eu/nestjson.php"


class CosmicRayCollector(BaseCollector):
    """Collects cosmic ray data from NMDB neutron monitors."""

    name = "cosmic_ray"
    poll_interval = 3600  # 1 hour (data updates hourly)
    endpoint = NMDB_ENDPOINT
    timeout = 30

    insert_query = """
        INSERT INTO cosmic_ray_data (time, station, count_rate, pressure_corrected, error)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (time, station) DO NOTHING
    """

    def __init__(self, pool):
        super().__init__(pool)
        self.stations = ["Oulu", "Climax", "McMurdo", "Thule"]  # Primary stations

    async def collect(self) -> list[dict[str, Any]]:
        """Fetch cosmic ray data from multiple neutron monitor stations."""
        all_records = []

        for station in self.stations:
            try:
                # Build URL with station parameter
                url = f"{self.endpoint}?station={station}&datatype=corr&format=hour"
                data = await self.fetch_json(url)
                records = self._parse_nmdb_data(data, station)
                all_records.extend(records)
                logger.info(f"Fetched {len(records)} cosmic ray records from {station}")
            except Exception as e:
                logger.error(f"Failed to fetch cosmic ray data from {station}: {e}")
                continue

        return all_records

    def _parse_nmdb_data(self, data: dict | list, station: str) -> list[dict]:
        """Parse NMDB JSON response."""
        records = []

        if not isinstance(data, dict):
            logger.warning(f"Expected dict from NMDB, got {type(data)}")
            return records

        try:
            # NMDB returns data in format: {"datatable": {"time": [...], "count": [...]}}
            datatable = data.get("datatable", {})
            times = datatable.get("time", [])
            counts = datatable.get("count", [])
            errors = datatable.get("error", [None] * len(times))

            for i, time_str in enumerate(times):
                try:
                    # Parse timestamp
                    time = datetime.fromisoformat(time_str.replace("Z", "+00:00"))

                    # Get count rate
                    count_rate = float(counts[i]) if i < len(counts) else None
                    if count_rate is None:
                        continue

                    # Get error if available
                    error = float(errors[i]) if i < len(errors) and errors[i] else None

                    records.append({
                        "time": time,
                        "station": station,
                        "count_rate": count_rate,
                        "pressure_corrected": count_rate,  # NMDB data is already corrected
                        "error": error,
                    })
                except (ValueError, TypeError, IndexError) as e:
                    logger.warning(f"Failed to parse cosmic ray record: {e}")
                    continue

        except Exception as e:
            logger.error(f"Failed to parse NMDB data: {e}")

        return records

    def format_record(self, record: dict) -> tuple:
        """Convert record dict to tuple matching insert_query."""
        return (
            record["time"],
            record["station"],
            record["count_rate"],
            record["pressure_corrected"],
            record["error"],
        )
