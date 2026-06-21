"""Tethys — GOES X-ray & Proton Flux Collector.

Fetches X-ray and proton flux data from NOAA SWPC GOES satellite endpoints.
Two endpoints, same table:
  - X-ray:  https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json
  - Proton: https://services.swpc.noaa.gov/json/goes/primary/integral-protons-7-day.json

API returns a JSON array of objects, each with:
  - time_tag     (ISO string)
  - flux         (string — must parseFloat)
  - energy       (string like "0.1-0.8nm" or ">=1 MeV")
  - satellite_tag (string)

Strategy: Fetch the 7-day file, filter for records newer than last stored timestamp.
"""

from datetime import datetime

import asyncpg

from backend.collectors.base import BaseCollector, logger

XRAY_ENDPOINT = "https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json"
PROTON_ENDPOINT = "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-7-day.json"

INSERT_QUERY = """
INSERT INTO goes_flux (time, flux_type, energy_band, flux, satellite)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (time, flux_type, energy_band, satellite) DO NOTHING
"""


class GOESFluxCollector(BaseCollector):
    """Collector for GOES X-ray and proton flux data."""

    name = "goes_flux"
    poll_interval = 60
    endpoint = XRAY_ENDPOINT  # Primary endpoint for logging
    insert_query = INSERT_QUERY

    def __init__(self, pool: asyncpg.Pool) -> None:
        super().__init__(pool)

    async def _fetch_endpoint(self, url: str, flux_type: str) -> list[dict]:
        """Fetch and parse a single endpoint into normalized records."""
        try:
            raw = await self.fetch_json(url)
        except Exception as e:
            logger.warning(f"goes_flux: failed to fetch {flux_type} from {url}: {e}")
            return []

        records = []
        for item in raw:
            try:
                time_tag = item["time_tag"]
                # NOAA returns ISO strings; parse to datetime
                if isinstance(time_tag, str):
                    # Handle "Z" suffix and plain ISO
                    time_tag = time_tag.replace("Z", "+00:00")
                    dt = datetime.fromisoformat(time_tag)
                else:
                    dt = time_tag  # already datetime

                flux_val = float(item["flux"])
                energy_band = item["energy"]
                satellite = item.get("satellite_tag", "goes-primary")

                records.append(
                    {
                        "time": dt,
                        "flux_type": flux_type,
                        "energy_band": energy_band,
                        "flux": flux_val,
                        "satellite": satellite,
                    }
                )
            except (KeyError, ValueError, TypeError) as e:
                logger.debug(f"goes_flux: skipping malformed {flux_type} record: {e}")
                continue

        return records

    async def collect(self) -> list[dict]:
        """Fetch X-ray and proton flux from both GOES endpoints."""
        xray_records = await self._fetch_endpoint(XRAY_ENDPOINT, "xray")
        proton_records = await self._fetch_endpoint(PROTON_ENDPOINT, "proton")

        all_records = xray_records + proton_records

        # Filter for records newer than last poll time (delta strategy)
        if self.last_poll_time:
            all_records = [r for r in all_records if r["time"] > self.last_poll_time]

        logger.info(
            f"goes_flux: collected {len(xray_records)} xray + "
            f"{len(proton_records)} proton = {len(all_records)} new records"
        )
        return all_records

    def format_record(self, record: dict) -> tuple:
        """Convert record dict to SQL parameter tuple."""
        return (
            record["time"],
            record["flux_type"],
            record["energy_band"],
            record["flux"],
            record["satellite"],
        )
