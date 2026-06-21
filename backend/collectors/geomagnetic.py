"""Tethys — Geomagnetic Indices Collector.

Collects Kp and Dst indices from NOAA SWPC — standard measures
of geomagnetic activity used by the space weather community.

Kp index: Planetary K-index (0-9 scale, 3-hour cadence)
  - 0-2: Quiet
  - 3-4: Unsettled
  - 5: Minor storm (G1)
  - 6: Moderate storm (G2)
  - 7: Strong storm (G3)
  - 8: Severe storm (G4)
  - 9: Extreme storm (G5)

Dst index: Disturbance Storm Time (nT, hourly)
  - 0 to -30: Quiet
  - -30 to -50: Weak storm
  - -50 to -100: Moderate storm
  - -100 to -200: Intense storm
  - < -200: Super storm (e.g., Carrington event: -850 nT)

Source: NOAA SWPC — https://services.swpc.noaa.gov/
"""

import logging
from datetime import datetime

import aiohttp

logger = logging.getLogger(__name__)

# NOAA SWPC endpoints for geomagnetic indices
KP_ENDPOINT = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
DST_ENDPOINT = "https://services.swpc.noaa.gov/products/solar-wind/dst-7-day.json"


async def fetch_kp_index() -> list[dict]:
    """Fetch current Kp index data from NOAA SWPC.

    Returns list of dicts with time, kp_value, and derived storm level.
    """
    try:
        async with (
            aiohttp.ClientSession() as session,
            session.get(KP_ENDPOINT, timeout=aiohttp.ClientTimeout(total=30)) as resp,
        ):
            resp.raise_for_status()
            data = await resp.json(content_type=None)

        # Format: [["time_tag", "Kp", "a_running", "station_count"], ...]
        if not data or len(data) < 2:
            return []

        records = []
        for row in data[1:]:
            if len(row) < 3:
                continue

            try:
                time_str = row[0]
                kp_value = int(row[1])

                records.append(
                    {
                        "time": datetime.fromisoformat(time_str.replace("Z", "+00:00")),
                        "kp_value": kp_value,
                        "storm_level": _classify_kp(kp_value),
                    }
                )
            except (ValueError, IndexError):
                continue

        return records

    except Exception as e:
        logger.warning(f"Failed to fetch Kp index: {e}")
        return []


async def fetch_dst_index() -> list[dict]:
    """Fetch Dst (Disturbance Storm Time) index from NOAA SWPC.

    Returns list of dicts with time and dst_value.
    """
    try:
        async with (
            aiohttp.ClientSession() as session,
            session.get(DST_ENDPOINT, timeout=aiohttp.ClientTimeout(total=30)) as resp,
        ):
            resp.raise_for_status()
            data = await resp.json(content_type=None)

        # Format: [["time_tag", "Dst"], ...]
        if not data or len(data) < 2:
            return []

        records = []
        for row in data[1:]:
            if len(row) < 2:
                continue

            try:
                time_str = row[0]
                dst_value = float(row[1])

                records.append(
                    {
                        "time": datetime.fromisoformat(time_str.replace("Z", "+00:00")),
                        "dst_value": dst_value,
                        "storm_level": _classify_dst(dst_value),
                    }
                )
            except (ValueError, IndexError):
                continue

        return records

    except Exception as e:
        logger.warning(f"Failed to fetch Dst index: {e}")
        return []


def _classify_kp(kp: int) -> str:
    """Classify Kp index into NOAA storm levels."""
    if kp >= 9:
        return "G5_extreme"
    if kp >= 8:
        return "G4_severe"
    if kp >= 7:
        return "G3_strong"
    if kp >= 6:
        return "G2_moderate"
    if kp >= 5:
        return "G1_minor"
    if kp >= 3:
        return "unsettled"
    return "quiet"


def _classify_dst(dst: float) -> str:
    """Classify Dst index into storm levels."""
    if dst < -200:
        return "super_storm"
    if dst < -100:
        return "intense_storm"
    if dst < -50:
        return "moderate_storm"
    if dst < -30:
        return "weak_storm"
    return "quiet"
