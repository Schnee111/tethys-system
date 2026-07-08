"""Tethys — Solar Wind Collector (DSCOVR / NOAA SWPC).

Collects solar wind plasma and magnetic field data from the NOAA Space Weather
Prediction Center. Data arrives as two separate JSON feeds:
- Plasma: density, speed, temperature
- Magnetometer: bx_gsm, by_gsm, bz_gsm, lon_gsm, lat_gsm, bt

Both are fetched per cycle and merged into a single solar_wind table via
separate upsert queries (plasma rows update plasma columns, mag rows update
mag columns, keyed on (time, source)).

API format: JSON array-of-arrays. Row 0 = header, rows 1+ = data. All values
are strings and must be parsed to float (or None for empty/null).
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from backend.collectors.base import BaseCollector

logger = logging.getLogger(__name__)

# NOAA SWPC endpoints — migrated from /products/solar-wind/ to /products/geospace/
# The new endpoint combines plasma + mag data in a single file
PLASMA_URL = "https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json"
MAG_URL = "https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json"  # same file

# Combined upsert — plasma + mag fields in a single row
COMBINED_INSERT_QUERY = """
INSERT INTO solar_wind (time, source, speed, density, temperature, bt, bx_gsm, by_gsm, bz_gsm)
VALUES ($1, 'dscovr', $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (time, source) DO UPDATE SET
    speed = COALESCE(EXCLUDED.speed, solar_wind.speed),
    density = COALESCE(EXCLUDED.density, solar_wind.density),
    temperature = COALESCE(EXCLUDED.temperature, solar_wind.temperature),
    bt = COALESCE(EXCLUDED.bt, solar_wind.bt),
    bx_gsm = COALESCE(EXCLUDED.bx_gsm, solar_wind.bx_gsm),
    by_gsm = COALESCE(EXCLUDED.by_gsm, solar_wind.by_gsm),
    bz_gsm = COALESCE(EXCLUDED.bz_gsm, solar_wind.bz_gsm)
"""

# Keep legacy names for backward compatibility
PLASMA_INSERT_QUERY = COMBINED_INSERT_QUERY
MAG_INSERT_QUERY = COMBINED_INSERT_QUERY


def _safe_float(value: str | float | None) -> float | None:
    """Parse a value to float, returning None for empty or invalid values."""
    if value is None:
        return None
    value = str(value).strip()
    if not value or value.lower() in ("null", "none", "nan", ""):
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _parse_combined_response(raw: list[list]) -> list[dict]:
    """Parse the new combined geospace/propagated-solar-wind response.

    New format has BOTH plasma and mag data in one file:
    Header: ["time_tag", "speed", "density", "temperature", "bx", "by", "bz", "bt", ...]

    Returns a flat list of records (no data_type split needed — both plasma and mag
    fields are in the same row, inserted via a single combined upsert).
    """
    if not raw or len(raw) < 2:
        return []

    header = raw[0]
    records: list[dict] = []

    for row in raw[1:]:
        if len(row) < len(header):
            row = row + [None] * (len(header) - len(row))

        row_dict = dict(zip(header, row, strict=False))

        time_str = row_dict.get("time_tag")
        if not time_str:
            continue

        try:
            ts = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=UTC)
        except (ValueError, TypeError):
            logger.debug("Skipping solar_wind row with unparseable time: %s", time_str)
            continue

        record = {
            "time": ts,
            "speed": _safe_float(row_dict.get("speed")),
            "density": _safe_float(row_dict.get("density")),
            "temperature": _safe_float(row_dict.get("temperature")),
            "bx_gsm": _safe_float(row_dict.get("bx")),
            "by_gsm": _safe_float(row_dict.get("by")),
            "bz_gsm": _safe_float(row_dict.get("bz")),
            "bt": _safe_float(row_dict.get("bt")),
        }
        records.append(record)

    return records


class SolarWindCollector(BaseCollector):
    """Collector for NOAA SWPC solar wind plasma and magnetometer data."""

    name = "solar_wind"
    poll_interval = 300  # 5 minutes
    endpoint = PLASMA_URL  # primary (for logging / store_raw)
    insert_query = PLASMA_INSERT_QUERY  # nominal; store() is overridden

    async def collect(self) -> list[dict]:
        """Fetch combined solar wind data from the new geospace endpoint."""
        combined_raw = await self.fetch_json(PLASMA_URL)
        return _parse_combined_response(combined_raw)

    def format_record(self, record: dict) -> tuple:
        """Convert record dict to tuple for combined upsert query."""
        return (
            record["time"],
            record.get("speed"),
            record.get("density"),
            record.get("temperature"),
            record.get("bt"),
            record.get("bx_gsm"),
            record.get("by_gsm"),
            record.get("bz_gsm"),
        )

    async def store(self, records: list[dict]) -> int:
        """Insert combined solar wind records (plasma + mag in one row)."""
        if not records:
            return 0
        # Filter out records with NULL time
        valid = [r for r in records if r.get("time") is not None]
        skipped = len(records) - len(valid)
        if skipped > 0:
            logger.warning(f"{self.name}: skipped {skipped} records with NULL time")
        if not valid:
            return 0
        async with self.pool.acquire() as conn, conn.transaction():
            values = [self.format_record(r) for r in valid]
            await conn.executemany(COMBINED_INSERT_QUERY, values)
            return len(values)
