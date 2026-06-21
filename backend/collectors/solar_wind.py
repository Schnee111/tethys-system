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

# NOAA SWPC endpoints — 7-day rolling windows
PLASMA_URL = "https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json"
MAG_URL = "https://services.swpc.noaa.gov/products/solar-wind/mag-7-day.json"

PLASMA_INSERT_QUERY = """
INSERT INTO solar_wind (time, source, density, speed, temperature)
VALUES ($1, 'dscovr', $2, $3, $4)
ON CONFLICT (time, source) DO UPDATE SET
    density = COALESCE(EXCLUDED.density, solar_wind.density),
    speed = COALESCE(EXCLUDED.speed, solar_wind.speed),
    temperature = COALESCE(EXCLUDED.temperature, solar_wind.temperature)
"""

MAG_INSERT_QUERY = """
INSERT INTO solar_wind (time, source, bt, bx_gsm, by_gsm, bz_gsm, lon_gsm, lat_gsm)
VALUES ($1, 'dscovr', $2, $3, $4, $5, $6, $7)
ON CONFLICT (time, source) DO UPDATE SET
    bt = COALESCE(EXCLUDED.bt, solar_wind.bt),
    bx_gsm = COALESCE(EXCLUDED.bx_gsm, solar_wind.bx_gsm),
    by_gsm = COALESCE(EXCLUDED.by_gsm, solar_wind.by_gsm),
    bz_gsm = COALESCE(EXCLUDED.bz_gsm, solar_wind.bz_gsm)
"""


def _safe_float(value: str | None) -> float | None:
    """Parse a string to float, returning None for empty or invalid values."""
    if value is None:
        return None
    value = str(value).strip()
    if not value or value.lower() in ("null", "none", "nan", ""):
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _parse_noaa_response(raw: list[list[str]], data_type: str) -> list[dict]:
    """Parse a NOAA SWPC JSON array-of-arrays into record dicts.

    Row 0 is the header. Rows 1+ are data. All values are strings.
    Each record is tagged with `data_type` so store() can route correctly.
    """
    if not raw or len(raw) < 2:
        return []

    header = raw[0]
    records: list[dict] = []

    for row in raw[1:]:
        if len(row) < len(header):
            # Pad short rows with None
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

        record: dict = {"time": ts, "data_type": data_type}

        if data_type == "plasma":
            record["density"] = _safe_float(row_dict.get("density"))
            record["speed"] = _safe_float(row_dict.get("speed"))
            record["temperature"] = _safe_float(row_dict.get("temperature"))
        elif data_type == "mag":
            record["bt"] = _safe_float(row_dict.get("bt"))
            record["bx_gsm"] = _safe_float(row_dict.get("bx_gsm"))
            record["by_gsm"] = _safe_float(row_dict.get("by_gsm"))
            record["bz_gsm"] = _safe_float(row_dict.get("bz_gsm"))
            record["lon_gsm"] = _safe_float(row_dict.get("lon_gsm"))
            record["lat_gsm"] = _safe_float(row_dict.get("lat_gsm"))

        records.append(record)

    return records


class SolarWindCollector(BaseCollector):
    """Collector for NOAA SWPC solar wind plasma and magnetometer data."""

    name = "solar_wind"
    poll_interval = 300  # 5 minutes
    endpoint = PLASMA_URL  # primary (for logging / store_raw)
    insert_query = PLASMA_INSERT_QUERY  # nominal; store() is overridden

    async def collect(self) -> list[dict]:
        """Fetch both plasma and magnetometer feeds and merge results."""
        plasma_raw = await self.fetch_json(PLASMA_URL)
        mag_raw = await self.fetch_json(MAG_URL)

        plasma_records = _parse_noaa_response(plasma_raw, "plasma")
        mag_records = _parse_noaa_response(mag_raw, "mag")

        return plasma_records + mag_records

    def format_record(self, record: dict) -> tuple:
        """Convert record dict to tuple. Not used directly — store() is overridden."""
        # Satisfy abstract requirement; not called because store() is overridden.
        return (
            record["time"],
            record.get("density"),
            record.get("speed"),
            record.get("temperature"),
        )

    async def store(self, records: list[dict]) -> int:
        """Insert plasma and mag records using their respective queries.

        Splits records by data_type and runs both upsert queries in a single
        transaction so the operation is atomic.
        """
        if not records:
            return 0

        plasma_tuples = [
            (r["time"], r.get("density"), r.get("speed"), r.get("temperature"))
            for r in records
            if r.get("data_type") == "plasma"
        ]
        mag_tuples = [
            (
                r["time"],
                r.get("bt"),
                r.get("bx_gsm"),
                r.get("by_gsm"),
                r.get("bz_gsm"),
                r.get("lon_gsm"),
                r.get("lat_gsm"),
            )
            for r in records
            if r.get("data_type") == "mag"
        ]

        total = 0
        async with self.pool.acquire() as conn, conn.transaction():
            if plasma_tuples:
                await conn.executemany(PLASMA_INSERT_QUERY, plasma_tuples)
                total += len(plasma_tuples)
            if mag_tuples:
                await conn.executemany(MAG_INSERT_QUERY, mag_tuples)
                total += len(mag_tuples)

        return total
