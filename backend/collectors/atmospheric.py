"""Tethys — Atmospheric Collector.

Fetches weather data from Open-Meteo for 150 strategic monitoring points.
MVP: 20 cities, batched in 2 requests of 10 coordinates each.

Source: https://api.open-meteo.com/v1/forecast
Poll interval: 6 hours (21600 seconds)
"""

from datetime import UTC, datetime
from typing import Any

from backend.collectors.base import BaseCollector

# ---------------------------------------------------------------------------
# 150 Strategic Monitoring Points
# ---------------------------------------------------------------------------
# Categories: cities(80), ocean(30), polar(10), tectonic(20), extreme(10)
# MVP subset: 20 major world cities
# ---------------------------------------------------------------------------

STRATEGIC_POINTS_MVP = [
    # Major world cities (20)
    {"name": "Jakarta", "lat": -6.21, "lon": 106.85, "category": "cities"},
    {"name": "Tokyo", "lat": 35.68, "lon": 139.69, "category": "cities"},
    {"name": "New York", "lat": 40.71, "lon": -74.01, "category": "cities"},
    {"name": "London", "lat": 51.51, "lon": -0.13, "category": "cities"},
    {"name": "Paris", "lat": 48.86, "lon": 2.35, "category": "cities"},
    {"name": "Sydney", "lat": -33.87, "lon": 151.21, "category": "cities"},
    {"name": "São Paulo", "lat": -23.55, "lon": -46.63, "category": "cities"},
    {"name": "Mumbai", "lat": 19.08, "lon": 72.88, "category": "cities"},
    {"name": "Cairo", "lat": 30.04, "lon": 31.24, "category": "cities"},
    {"name": "Moscow", "lat": 55.76, "lon": 37.62, "category": "cities"},
    {"name": "Beijing", "lat": 39.90, "lon": 116.40, "category": "cities"},
    {"name": "Berlin", "lat": 52.52, "lon": 13.41, "category": "cities"},
    {"name": "Bangkok", "lat": 13.76, "lon": 100.50, "category": "cities"},
    {"name": "Lagos", "lat": 6.52, "lon": 3.38, "category": "cities"},
    {"name": "Mexico City", "lat": 19.43, "lon": -99.13, "category": "cities"},
    {"name": "Seoul", "lat": 37.57, "lon": 126.98, "category": "cities"},
    {"name": "Istanbul", "lat": 41.01, "lon": 28.98, "category": "cities"},
    {"name": "Dubai", "lat": 25.20, "lon": 55.27, "category": "cities"},
    {"name": "Singapore", "lat": 1.35, "lon": 103.82, "category": "cities"},
    {"name": "Nairobi", "lat": -1.29, "lon": 36.82, "category": "cities"},
]


def _make_request_coords(points: list[dict]) -> dict:
    """Build parallel arrays of lat/lon for Open-Meteo multi-location request."""
    return {
        "latitude": ",".join(str(p["lat"]) for p in points),
        "longitude": ",".join(str(p["lon"]) for p in points),
    }


class AtmosphericCollector(BaseCollector):
    """Collector for Open-Meteo weather forecast data.

    Fetches daily weather (temperature, precipitation, wind) for strategic
    monitoring points. Batches coordinates to minimize API calls.
    """

    name = "atmospheric"
    poll_interval = 21600  # 6 hours
    endpoint = "https://api.open-meteo.com/v1/forecast"
    timeout = 60  # longer timeout for batched requests

    insert_query = """
        INSERT INTO atmospheric_data (
            time, location_name, latitude, longitude, category,
            temperature, temp_min, precipitation, wind_speed, wind_dir
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (time, location_name) DO UPDATE SET
            temperature = COALESCE(EXCLUDED.temperature, atmospheric_data.temperature),
            temp_min = COALESCE(EXCLUDED.temp_min, atmospheric_data.temp_min),
            wind_speed = COALESCE(EXCLUDED.wind_speed, atmospheric_data.wind_speed)
    """

    def __init__(self, pool, points: list[dict] | None = None, batch_size: int = 10):
        """Initialize with optional custom points list and batch size.

        Args:
            pool: asyncpg connection pool
            points: List of dicts with keys: name, lat, lon, category
                    Defaults to STRATEGIC_POINTS_MVP
            batch_size: Number of coordinates per API request (default 10 for MVP)
        """
        super().__init__(pool)
        self.points = points or STRATEGIC_POINTS_MVP
        self.batch_size = batch_size

    async def collect(self) -> list[dict[str, Any]]:
        """Fetch weather data from Open-Meteo for all strategic points.

        Batches coordinates into groups of batch_size, makes parallel-array
        requests, and parses the response into record dicts.
        """
        all_records: list[dict[str, Any]] = []

        # Backfill: use 92 days on first run, 2 days on subsequent runs
        past_days = 92 if self.last_poll_time is None else 2

        # Split points into batches
        for i in range(0, len(self.points), self.batch_size):
            batch = self.points[i : i + self.batch_size]
            coords = _make_request_coords(batch)

            url = (
                f"{self.endpoint}"
                f"?latitude={coords['latitude']}"
                f"&longitude={coords['longitude']}"
                f"&past_days={past_days}"
                f"&forecast_days=0"
                f"&daily=temperature_2m_max,temperature_2m_min,"
                f"precipitation_sum,wind_speed_10m_max,"
                f"wind_direction_10m_dominant"
                f"&timezone=auto"
            )

            data = await self.fetch_json(url)

            # Open-Meteo returns a single object for single coords,
            # or a list for multiple coords
            responses = data if isinstance(data, list) else [data]

            for resp_idx, response in enumerate(responses):
                point = batch[resp_idx]
                records = self._parse_daily_response(response, point)
                all_records.extend(records)

        return all_records

    def _parse_daily_response(
        self, response: dict[str, Any], point: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Parse Open-Meteo daily response for one location.

        Open-Meteo returns parallel arrays — zip them together:
            daily.time[i] <-> daily.temperature_2m_max[i] <-> etc.

        Date strings are parsed to datetime with midday (12:00 UTC) added.
        """
        daily = response.get("daily", {})
        times = daily.get("time", [])
        temp_max = daily.get("temperature_2m_max", [])
        temp_min = daily.get("temperature_2m_min", [])
        precip = daily.get("precipitation_sum", [])
        wind_speed = daily.get("wind_speed_10m_max", [])
        wind_dir = daily.get("wind_direction_10m_dominant", [])

        # lat/lon may come from response or from our point definition
        lat = response.get("latitude", point["lat"])
        lon = response.get("longitude", point["lon"])

        records = []
        for i, date_str in enumerate(times):
            record = {
                "time": self._parse_date(date_str),
                "location_name": point["name"],
                "latitude": float(lat),
                "longitude": float(lon),
                "category": point["category"],
                "temperature": self._safe_float(temp_max, i),
                "temp_min": self._safe_float(temp_min, i),
                "precipitation": self._safe_float(precip, i),
                "wind_speed": self._safe_float(wind_speed, i),
                "wind_dir": self._safe_float(wind_dir, i),
            }
            records.append(record)

        return records

    @staticmethod
    def _parse_date(date_str: str) -> datetime:
        """Parse ISO date string to datetime at 12:00 UTC (midday).

        Args:
            date_str: Date in 'YYYY-MM-DD' format

        Returns:
            datetime at 12:00 UTC on that date
        """
        return datetime.fromisoformat(date_str).replace(hour=12, minute=0, second=0, tzinfo=UTC)

    @staticmethod
    def _safe_float(arr: list, index: int) -> float | None:
        """Safely extract float from parallel array, returns None if missing."""
        if index < len(arr):
            val = arr[index]
            if val is None:
                return None
            return float(val)
        return None

    def format_record(self, record: dict[str, Any]) -> tuple:
        """Convert record dict to tuple matching insert_query placeholders.

        Order: time, location_name, latitude, longitude, category,
               temperature, temp_min, precipitation, wind_speed, wind_dir
        """
        return (
            record["time"],
            record["location_name"],
            record["latitude"],
            record["longitude"],
            record["category"],
            record["temperature"],
            record["temp_min"],
            record["precipitation"],
            record["wind_speed"],
            record["wind_dir"],
        )
