"""Tethys — Cosmic Ray Collector.

Fetches cosmic ray proxy data from GOES integral protons.
High-energy proton events are related to solar energetic particles (SEPs)
and can be used as a proxy for cosmic ray activity.
"""

import logging
from datetime import UTC, datetime
from typing import Any

from backend.collectors.base import BaseCollector

logger = logging.getLogger(__name__)

# GOES integral protons endpoint (7-day data)
GOES_PROTONS_ENDPOINT = "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-7-day.json"


class CosmicRayCollector(BaseCollector):
    """Collects cosmic ray proxy data from GOES integral protons."""

    name = "cosmic_ray"
    poll_interval = 300  # 5 minutes (data updates every 5 minutes)
    endpoint = GOES_PROTONS_ENDPOINT
    timeout = 30

    insert_query = """
        INSERT INTO cosmic_ray_data (time, station, count_rate, pressure_corrected, error)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (time, station) DO NOTHING
    """

    def __init__(self, pool):
        super().__init__(pool)
        # Focus on high-energy protons as cosmic ray proxy
        self.energy_bands = [">=100 MeV", ">=500 MeV", ">=10 MeV"]

    async def collect(self) -> list[dict[str, Any]]:
        """Fetch GOES integral protons data."""
        all_records = []

        try:
            data = await self.fetch_json(self.endpoint)
            if isinstance(data, list):
                all_records.extend(self._parse_protons_data(data))
        except Exception as e:
            logger.error(f"Failed to fetch GOES protons data: {e}")

        return all_records

    def _parse_protons_data(self, data: list[dict]) -> list[dict]:
        """Parse GOES integral protons data."""
        records = []

        # Group by time to aggregate multiple energy bands
        time_groups = {}
        for item in data:
            try:
                time_str = item.get("time_tag")
                if not time_str:
                    continue

                # Ensure timezone-aware datetime
                time = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                if time.tzinfo is None:
                    time = time.replace(tzinfo=UTC)

                energy = item.get("energy", "")
                flux = float(item.get("flux", 0))
                satellite = item.get("satellite", "unknown")

                # Only process energy bands we care about
                if energy not in self.energy_bands:
                    continue

                # Group by time
                time_key = time.isoformat()
                if time_key not in time_groups:
                    time_groups[time_key] = {
                        "time": time,
                        "fluxes": {},
                        "satellite": satellite,
                    }

                time_groups[time_key]["fluxes"][energy] = flux

            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse proton record: {e}")
                continue

        # Create records for each time point
        for time_key, group in time_groups.items():
            try:
                # Use >=100 MeV as primary cosmic ray proxy
                primary_flux = group["fluxes"].get(">=100 MeV", 0)
                if primary_flux == 0:
                    # Fallback to >=10 MeV if >=100 MeV not available
                    primary_flux = group["fluxes"].get(">=10 MeV", 0)

                # Create composite station name
                station = f"goes-{group['satellite']}"

                records.append({
                    "time": group["time"],
                    "station": station,
                    "count_rate": primary_flux,
                    "pressure_corrected": primary_flux,  # No pressure correction needed for satellite data
                    "error": None,
                })

            except Exception as e:
                logger.warning(f"Failed to create record for {time_key}: {e}")
                continue

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
