"""Tethys — Geomagnetic Indices Collector.

Fetches geomagnetic indices (Kp, Dst, AE) from NOAA SWPC.
These are critical for understanding geomagnetic response to solar wind.
"""

import logging
from datetime import UTC, datetime
from typing import Any

from backend.collectors.base import BaseCollector

logger = logging.getLogger(__name__)

# NOAA SWPC geomagnetic indices endpoints
KP_ENDPOINT = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
DST_ENDPOINT = "https://services.swpc.noaa.gov/products/kyoto-dst.json"
AE_ENDPOINT = "https://services.swpc.noaa.gov/products/planetary_a_index.json"


def _classify_kp(kp: float) -> str:
    """Map a Kp index to its NOAA G-scale storm level.

    Kp 0-2: quiet, 3: unsettled, 4: active, then G-scale storm levels
    (NOAA space weather scales).
    """
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
    if kp >= 4:
        return "active"
    if kp >= 3:
        return "unsettled"
    return "quiet"


def _classify_dst(dst: float) -> str:
    """Map a Dst index (nT) to its geomagnetic storm level.

    Dst is negative during storms; more negative = stronger storm.
    """
    if dst <= -250:
        return "super_storm"
    if dst <= -100:
        return "intense_storm"
    if dst <= -50:
        return "moderate_storm"
    if dst <= -30:
        return "weak_storm"
    return "quiet"


class GeomagneticCollector(BaseCollector):
    """Collects geomagnetic indices (Kp, Dst, AE) from NOAA SWPC."""

    name = "geomagnetic"
    poll_interval = 300  # 5 minutes (indices update hourly but we poll more frequently)
    endpoint = KP_ENDPOINT  # Primary endpoint
    timeout = 30

    insert_query = """
        INSERT INTO geomagnetic_indices (time, index_type, value, storm_level)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (time, index_type) DO NOTHING
    """

    def __init__(self, pool):
        super().__init__(pool)
        self.endpoints = {
            "kp": KP_ENDPOINT,
            "dst": DST_ENDPOINT,
            "ae": AE_ENDPOINT,
        }

    async def collect(self) -> list[dict[str, Any]]:
        """Fetch geomagnetic indices from all endpoints."""
        all_records = []

        # Fetch Kp index
        try:
            kp_data = await self.fetch_json(self.endpoints["kp"])
            if isinstance(kp_data, list):
                all_records.extend(self._parse_kp(kp_data))
        except Exception as e:
            logger.error(f"Failed to fetch Kp index: {e}")

        # Fetch Dst index
        try:
            dst_data = await self.fetch_json(self.endpoints["dst"])
            if isinstance(dst_data, list):
                all_records.extend(self._parse_dst(dst_data))
        except Exception as e:
            logger.error(f"Failed to fetch Dst index: {e}")

        # Fetch AE index
        try:
            ae_data = await self.fetch_json(self.endpoints["ae"])
            if isinstance(ae_data, list):
                all_records.extend(self._parse_ae(ae_data))
        except Exception as e:
            logger.error(f"Failed to fetch AE index: {e}")

        return all_records

    def _parse_kp(self, data: list[dict]) -> list[dict]:
        """Parse Kp index data."""
        records = []
        for item in data:
            try:
                time_str = item.get("time_tag")
                if not time_str:
                    continue

                # Ensure timezone-aware datetime
                time = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                if time.tzinfo is None:
                    time = time.replace(tzinfo=UTC)
                
                kp_value = float(item.get("Kp", 0))

                # Determine storm level based on Kp
                storm_level = self._kp_to_storm_level(kp_value)

                records.append({
                    "time": time,
                    "index_type": "kp",
                    "value": kp_value,
                    "storm_level": storm_level,
                })
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse Kp record: {e}")
                continue

        return records

    def _parse_dst(self, data: list[dict]) -> list[dict]:
        """Parse Dst index data (JSON format)."""
        records = []

        for item in data:
            try:
                time_str = item.get("time_tag")
                if not time_str:
                    continue

                # Ensure timezone-aware datetime
                time = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                if time.tzinfo is None:
                    time = time.replace(tzinfo=UTC)
                
                dst_value = float(item.get("dst", 0))

                # Determine storm level based on Dst
                storm_level = self._dst_to_storm_level(dst_value)

                records.append({
                    "time": time,
                    "index_type": "dst",
                    "value": dst_value,
                    "storm_level": storm_level,
                })
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse Dst record: {e}")
                continue

        return records

    def _parse_ae(self, data: list[dict]) -> list[dict]:
        """Parse AE index data (JSON format)."""
        records = []

        for item in data:
            try:
                time_str = item.get("time_tag")
                if not time_str:
                    continue

                # Ensure timezone-aware datetime
                time = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                if time.tzinfo is None:
                    time = time.replace(tzinfo=UTC)
                
                ae_value = float(item.get("AE", 0))

                records.append({
                    "time": time,
                    "index_type": "ae",
                    "value": ae_value,
                    "storm_level": None,  # AE doesn't have storm levels
                })
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to parse AE record: {e}")
                continue

        return records

    def _kp_to_storm_level(self, kp: float) -> str:
        """Convert Kp index to storm level."""
        if kp >= 9:
            return "extreme"
        elif kp >= 8:
            return "severe"
        elif kp >= 7:
            return "strong"
        elif kp >= 6:
            return "moderate"
        elif kp >= 5:
            return "minor"
        elif kp >= 4:
            return "unsettled"
        else:
            return "quiet"

    def _dst_to_storm_level(self, dst: float) -> str:
        """Convert Dst index to storm level."""
        if dst <= -250:
            return "extreme"
        elif dst <= -100:
            return "intense"
        elif dst <= -50:
            return "moderate"
        elif dst <= -30:
            return "minor"
        else:
            return "quiet"

    def format_record(self, record: dict) -> tuple:
        """Convert record dict to tuple matching insert_query."""
        return (
            record["time"],
            record["index_type"],
            record["value"],
            record["storm_level"],
        )
