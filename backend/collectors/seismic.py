"""Tethys — Seismic Collector.

Fetches earthquake data from the USGS Earthquake GeoJSON feed.
Parses GeoJSON FeatureCollection into records for the seismic_events table.

Source: https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson
"""

from datetime import UTC, datetime
from typing import Any

from backend.collectors.base import BaseCollector


class SeismicCollector(BaseCollector):
    """Collector for USGS earthquake seismic events."""

    name = "seismic"
    poll_interval = 60
    endpoint = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"
    insert_query = """
        INSERT INTO seismic_events (
            time, event_id, magnitude, latitude, longitude, depth_km,
            place, type, tsunami, sig, alert, felt, mag_type, net, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (time, event_id) DO NOTHING
    """

    async def collect(self) -> list[dict[str, Any]]:
        """Fetch earthquake data from USGS GeoJSON feed.

        First run: fetches 30-day backlog (all_month.geojson).
        Subsequent runs: fetches past hour (all_hour.geojson).
        Returns list of parsed event dicts ready for format_record().
        """
        # Backfill: use 30-day feed on first run for more historical data
        if self.last_poll_time is None:
            url = self.endpoint.replace("all_hour", "all_month")
        else:
            url = self.endpoint

        data = await self.fetch_json(url)
        features = data.get("features", [])
        return [self._parse_feature(f) for f in features]

    def _parse_feature(self, feature: dict[str, Any]) -> dict[str, Any]:
        """Parse a single GeoJSON feature into a record dict."""
        props = feature.get("properties", {})
        coords = feature.get("geometry", {}).get("coordinates", [0, 0, 0])

        # coords = [longitude, latitude, depth_km]
        timestamp_ms = props.get("time", 0)

        return {
            "time": datetime.fromtimestamp(timestamp_ms / 1000, tz=UTC),
            "event_id": feature.get("id", ""),
            "magnitude": float(props.get("mag") or 0.0),
            "latitude": float(coords[1]) if len(coords) > 1 else 0.0,
            "longitude": float(coords[0]) if len(coords) > 0 else 0.0,
            "depth_km": float(coords[2]) if len(coords) > 2 else None,
            "place": props.get("place"),
            "type": props.get("type", "earthquake"),
            "tsunami": int(props.get("tsunami") or 0),
            "sig": props.get("sig"),
            "alert": props.get("alert"),
            "felt": props.get("felt"),
            "cdi": props.get("cdi"),
            "mmi": props.get("mmi"),
            "mag_type": props.get("magType"),
            "net": props.get("net"),
            "raw_data": feature,
        }

    def format_record(self, record: dict[str, Any]) -> tuple:
        """Convert record dict to tuple matching insert_query placeholders.

        Order: time, event_id, magnitude, latitude, longitude, depth_km,
               place, type, tsunami, sig, alert, felt, mag_type, net, raw_data

        Note: cdi and mmi are parsed but not in the INSERT — they'd need
        extra columns. Storing them in raw_data JSONB covers it.
        """
        import json

        return (
            record["time"],
            record["event_id"],
            record["magnitude"],
            record["latitude"],
            record["longitude"],
            record["depth_km"],
            record["place"],
            record["type"],
            record["tsunami"],
            record["sig"],
            record["alert"],
            record["felt"],
            record["mag_type"],
            record["net"],
            json.dumps(record["raw_data"]),
        )
