"""Tethys — Ionospheric TEC Collector.

Fetches Total Electron Content data from NASA JPL Global Ionosphere Maps.
Ionospheric anomalies are critical for LAIC (Lithosphere-Atmosphere-Ionosphere Coupling) theory
and earthquake precursor detection.
"""

import logging
from datetime import UTC, datetime
from typing import Any

from backend.collectors.base import BaseCollector

logger = logging.getLogger(__name__)

# NASA JPL IONEX endpoint (hourly updates)
JPL_IONEX_ENDPOINT = "https://cddis.nasa.gov/archive/gnss/products/ionex/"


class IonosphericCollector(BaseCollector):
    """Collects ionospheric TEC data from NASA JPL."""

    name = "ionospheric"
    poll_interval = 3600  # 1 hour (IONEX files update hourly)
    endpoint = JPL_IONEX_ENDPOINT
    timeout = 30

    insert_query = """
        INSERT INTO ionospheric_data (time, latitude, longitude, tec_value, rms_error)
        VALUES ($1, $2, $3, $4, $5)
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
        """Fetch IONEX data from NASA JPL."""
        all_records = []

        try:
            # Get latest IONEX file (JPL provides hourly files)
            # Format: jplgddd0.yyi (ddd = day of year, yy = year, i = file letter a-x)
            now = datetime.now(UTC)
            day_of_year = now.timetuple().tm_yday
            year = now.year % 100
            
            # Try to fetch latest file (file 'x' is usually latest)
            for file_letter in reversed("abcdefghijklmnopqrstuvwx"):
                filename = f"jplg{day_of_year:03d}0.{year:02d}{file_letter}"
                url = f"{self.endpoint}{now.year}/{day_of_year:03d}/{filename}.Z"
                
                try:
                    data = await self.fetch_json(url)
                    if data:
                        records = self._parse_ionex_data(data, now)
                        all_records.extend(records)
                        logger.info(f"Fetched {len(records)} ionospheric records from {filename}")
                        break
                except Exception as e:
                    logger.debug(f"Failed to fetch {filename}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Failed to fetch ionospheric data: {e}")

        return all_records

    def _parse_ionex_data(self, data: dict, base_time: datetime) -> list[dict]:
        """Parse IONEX file format."""
        records = []

        try:
            # IONEX format contains TEC maps at different epochs
            # For simplicity, we'll extract TEC values from the map
            tec_maps = data.get("TEC_MAP", [])
            
            for tec_map in tec_maps:
                epoch = tec_map.get("EPOCH", {})
                time = datetime(
                    epoch.get("YEAR", base_time.year),
                    epoch.get("MONTH", base_time.month),
                    epoch.get("DAY", base_time.day),
                    epoch.get("HOUR", base_time.hour),
                    tzinfo=UTC
                )

                # Extract TEC values from the map grid
                lat_start = tec_map.get("LAT1", -87.5)
                lat_end = tec_map.get("LAT2", 87.5)
                lat_step = tec_map.get("DLAT", 2.5)
                lon_start = tec_map.get("LON1", -180)
                lon_end = tec_map.get("LON2", 180)
                lon_step = tec_map.get("DLON", 5.0)

                tec_data = tec_map.get("DATA", [])
                
                # Parse TEC values (stored in TECU * 10)
                lat_idx = 0
                data_idx = 0
                lat = lat_start
                
                while lat <= lat_end and data_idx < len(tec_data):
                    lon = lon_start
                    for lon_idx in range(int((lon_end - lon_start) / lon_step) + 1):
                        if data_idx < len(tec_data):
                            # Convert from TECU * 10 to TECU
                            tec_value = tec_data[data_idx] / 10.0
                            
                            # Only store data from regions of interest
                            if self._is_in_region(lat, lon):
                                records.append({
                                    "time": time,
                                    "latitude": lat,
                                    "longitude": lon,
                                    "tec_value": tec_value,
                                    "rms_error": None,  # RMS not always available
                                })
                            
                            data_idx += 1
                        lon += lon_step
                    
                    lat += lat_step
                    lat_idx += 1

        except Exception as e:
            logger.error(f"Failed to parse IONEX data: {e}")

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
            record["rms_error"],
        )
