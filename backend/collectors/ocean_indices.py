"""Tethys — Ocean Indices Collector.

Fetches ENSO (El Niño/La Niña) and NAO (North Atlantic Oscillation) indices.
These climate patterns affect atmospheric circulation and may correlate with space weather propagation.
"""

import logging
from datetime import UTC, datetime
from typing import Any

from backend.collectors.base import BaseCollector

logger = logging.getLogger(__name__)

# NOAA CPC ENSO indices
ENSO_ENDPOINT = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"


class OceanIndicesCollector(BaseCollector):
    """Collects ocean climate indices (ENSO/NAO)."""

    name = "ocean_indices"
    poll_interval = 86400  # 24 hours (monthly data)
    endpoint = ENSO_ENDPOINT
    timeout = 30

    insert_query = """
        INSERT INTO ocean_indices (time, index_type, value, anomaly, classification)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (time, index_type) DO NOTHING
    """

    def __init__(self, pool):
        super().__init__(pool)

    async def collect(self) -> list[dict[str, Any]]:
        """Fetch ocean indices data."""
        all_records = []

        # Fetch ENSO data
        try:
            data = await self.fetch_text(self.endpoint)
            records = self._parse_enso_data(data)
            all_records.extend(records)
            logger.info(f"Fetched {len(records)} ENSO records")
        except Exception as e:
            logger.error(f"Failed to fetch ENSO data: {e}")

        return all_records

    async def fetch_text(self, url: str) -> str:
        """Fetch text data from URL."""
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=self.timeout)) as resp:
                resp.raise_for_status()
                return await resp.text()

    def _parse_enso_data(self, data: str) -> list[dict]:
        """Parse ENSO ASCII data."""
        records = []

        try:
            lines = data.strip().split('\n')
            
            # Skip header line
            for line in lines[1:]:
                if not line.strip():
                    continue

                parts = line.split()
                if len(parts) < 4:
                    continue

                season = parts[0]
                year = int(parts[1])
                total = float(parts[2])
                anomaly = float(parts[3])

                # Convert season to date (use middle of season)
                season_to_month = {
                    'DJF': 1, 'JFM': 2, 'FMA': 3, 'MAM': 4,
                    'AMJ': 5, 'MJJ': 6, 'JJA': 7, 'JAS': 8,
                    'ASO': 9, 'SON': 10, 'OND': 11, 'NDJ': 12
                }
                
                month = season_to_month.get(season, 1)
                time = datetime(year, month, 15, tzinfo=UTC)  # Mid-month

                # Classify ENSO state
                classification = self._classify_enso(anomaly)

                records.append({
                    "time": time,
                    "index_type": "enso",
                    "value": total,
                    "anomaly": anomaly,
                    "classification": classification,
                })

        except Exception as e:
            logger.error(f"Failed to parse ENSO data: {e}")

        return records

    def _classify_enso(self, anomaly: float) -> str:
        """Classify ENSO state based on anomaly."""
        if anomaly >= 0.5:
            return "el_nino"
        elif anomaly <= -0.5:
            return "la_nina"
        else:
            return "neutral"

    def format_record(self, record: dict) -> tuple:
        """Convert record dict to tuple matching insert_query."""
        return (
            record["time"],
            record["index_type"],
            record["value"],
            record["anomaly"],
            record["classification"],
        )
