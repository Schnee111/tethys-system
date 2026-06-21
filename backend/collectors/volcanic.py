"""Tethys — Volcanic Collector.

Fetches active volcanic event data from NASA's EONET (Earth Observatory Natural Event Tracker).
Parses the EONET v3 API response into records for the volcanic_events table.

Source: https://eonet.gsfc.nasa.gov/api/v3/events?category=volcanoes
"""

import json
from datetime import UTC, datetime
from typing import Any

from backend.collectors.base import BaseCollector


class VolcanicCollector(BaseCollector):
    """Collector for NASA EONET volcanic events."""

    name = "volcanic"
    poll_interval = 3600  # 1 hour
    endpoint = "https://eonet.gsfc.nasa.gov/api/v3/events?category=volcanoes"
    insert_query = """
        INSERT INTO volcanic_events (
            time, event_id, volcano_name, latitude, longitude,
            elevation_m, event_type, vei, description, link, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (time, event_id) DO NOTHING
    """

    async def collect(self) -> list[dict[str, Any]]:
        """Fetch volcanic event data from NASA EONET API.

        Returns list of parsed event dicts ready for format_record().
        Only includes active (not closed) events.
        """
        data = await self.fetch_json(self.endpoint)
        events = data.get("events", [])
        return [self._parse_event(e) for e in events if e.get("closed") is None]

    def _parse_event(self, event: dict[str, Any]) -> dict[str, Any]:
        """Parse a single EONET event into a record dict.

        GeoJSON convention: coordinates are [longitude, latitude].
        Uses the last geometry entry for the most recent location.
        """
        geometry = event.get("geometry", [{}])
        # Use last geometry entry (most recent)
        last_geom = geometry[-1] if geometry else {}

        coords = last_geom.get("coordinates", [0.0, 0.0])
        # GeoJSON: [longitude, latitude]
        longitude = float(coords[0]) if len(coords) > 0 else 0.0
        latitude = float(coords[1]) if len(coords) > 1 else 0.0

        # Parse ISO timestamp
        date_str = last_geom.get("date", "")
        if date_str:
            try:
                time = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                time = datetime.now(UTC)
        else:
            time = datetime.now(UTC)

        # Sources: first source URL becomes the link
        sources = event.get("sources", [])
        link = sources[0].get("url") if sources else None

        # Description: EONET doesn't provide a separate description field,
        # so we use the event title as a fallback
        description = event.get("description") or event.get("title")

        return {
            "time": time,
            "event_id": event.get("id", ""),
            "volcano_name": event.get("title", ""),
            "latitude": latitude,
            "longitude": longitude,
            "elevation_m": None,  # Not provided by EONET API
            "event_type": None,  # Not provided by EONET API
            "vei": None,  # Not provided by EONET API
            "description": description,
            "link": link,
            "raw_data": event,
        }

    def format_record(self, record: dict[str, Any]) -> tuple:
        """Convert record dict to tuple matching insert_query placeholders.

        Order: time, event_id, volcano_name, latitude, longitude,
               elevation_m, event_type, vei, description, link, raw_data
        """
        return (
            record["time"],
            record["event_id"],
            record["volcano_name"],
            record["latitude"],
            record["longitude"],
            record["elevation_m"],
            record["event_type"],
            record["vei"],
            record["description"],
            record["link"],
            json.dumps(record["raw_data"]),
        )
