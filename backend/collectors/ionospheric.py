"""Tethys — Ionospheric TEC Collector.

Fetches Total Electron Content data from NOAA SWPC GLOTEC (Global TEC).
Ionospheric anomalies are critical for LAIC (Lithosphere-Atmosphere-Ionosphere Coupling) theory
and earthquake precursor detection.
"""

import logging
from datetime import UTC, datetime
from typing import Any

from backend.collectors.base import BaseCollector

logger = logging.getLogger(__name__)

# NOAA SWPC GLOTEC endpoints
GLOTEC_INDEX_URL = "https://services.swpc.noaa.gov/products/glotec/geojson_2d_urt.json"
GLOTEC_BASE_URL = "https://services.swpc.noaa.gov"


class IonosphericCollector(BaseCollector):
    """Collects ionospheric TEC data from NOAA SWPC GLOTEC."""

    name = "ionospheric"
    poll_interval = 600  # 10 minutes (data updates every 10 min)
    endpoint = GLOTEC_INDEX_URL
    timeout = 30

    insert_query = """
        INSERT INTO ionospheric_data (time, latitude, longitude, tec_value, anomaly, hmF2, NmF2, quality_flag)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (time, latitude, longitude) DO NOTHING
    """

    def __init__(self, pool):
        super().__init__(pool)
        # Focus on key regions for earthquake monitoring
        self.regions = [
            {"name": "pacific_ring", "lat_range": (-60, 60), "lon_range": (120, 300)},
            {"name": "mediterranean", "lat_range": (30, 45), "lon_range": (-10, 40)},
            {"name": "indian_ocean", "lat_range": (-30, 30), "lon_range": (60, 120)},
        ]

    async def collect(self) -> list[dict[str, Any]]:
        """Fetch GLOTEC data from NOAA SWPC."""
        all_records = []

        try:
            # Get list of available files
            index_data = await self.fetch_json(self.endpoint)
            if not isinstance(index_data, list) or len(index_data) == 0:
                logger.warning("No GLOTEC files available")
                return []

            # Get the latest file (last in the list)
            latest_file = index_data[-1]
            file_url = f"{GLOTEC_BASE_URL}{latest_file['url']}"
            time_tag = latest_file['time_tag']

            logger.info(f"Fetching GLOTEC data from {file_url}")

            # Fetch the GeoJSON file
            geojson_data = await self.fetch_json(file_url)
            if isinstance(geojson_data, dict) and 'features' in geojson_data:
                records = self._parse_geojson(geojson_data, time_tag)
                all_records.extend(records)
                logger.info(f"Fetched {len(records)} ionospheric records from {latest_file['url']}")

        except Exception as e:
            logger.error(f"Failed to fetch ionospheric data: {e}")

        return all_records

    def _parse_geojson(self, geojson: dict, time_tag: str) -> list[dict]:
        """Parse GLOTEC GeoJSON format."""
        records = []

        try:
            # Parse time
            time = datetime.fromisoformat(time_tag.replace("Z", "+00:00"))
            if time.tzinfo is None:
                time = time.replace(tzinfo=UTC)

            features = geojson.get('features', [])

            for feature in features:
                try:
                    geometry = feature.get('geometry', {})
                    properties = feature.get('properties', {})

                    # Get coordinates [lon, lat]
                    coords = geometry.get('coordinates', [])
                    if len(coords) < 2:
                        continue

                    lon, lat = coords[0], coords[1]

                    # Only store data from regions of interest
                    if not self._is_in_region(lat, lon):
                        continue

                    # Extract properties
                    tec_value = properties.get('tec')
                    anomaly = properties.get('anomaly')
                    hmF2 = properties.get('hmF2')  # Peak height
                    NmF2 = properties.get('NmF2')  # Peak density
                    quality_flag = properties.get('quality_flag', 0)

                    if tec_value is None:
                        continue

                    records.append({
                        "time": time,
                        "latitude": lat,
                        "longitude": lon,
                        "tec_value": tec_value,
                        "anomaly": anomaly,
                        "hmF2": hmF2,
                        "NmF2": NmF2,
                        "quality_flag": quality_flag,
                    })

                except (ValueError, TypeError, KeyError) as e:
                    logger.warning(f"Failed to parse feature: {e}")
                    continue

        except Exception as e:
            logger.error(f"Failed to parse GeoJSON data: {e}")

        return records

    def _is_in_region(self, lat: float, lon: float) -> bool:
        """Check if coordinates are in any region of interest."""
        for region in self.regions:
            lat_range = region["lat_range"]
            lon_range = region["lon_range"]

            if (lat_range[0] <= lat <= lat_range[1] and
                lon_range[0] <= lon <= lon_range[1]):
                return True

        return False

    def format_record(self, record: dict) -> tuple:
        """Convert record dict to tuple matching insert_query."""
        return (
            record["time"],
            record["latitude"],
            record["longitude"],
            record["tec_value"],
            record.get("anomaly"),
            record.get("hmF2"),
            record.get("NmF2"),
            record.get("quality_flag", 0),
        )
