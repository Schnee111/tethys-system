"""Tethys — DONKI Space Weather Collector.

Fetches space weather events from NASA's DONKI (Database Of Notifications,
Knowledge, Information) API. Collects four event types:
- CME (Coronal Mass Ejection)
- GST (Geomagnetic Storm)
- FLR (Solar Flare)
- IPS (Interplanetary Shock)

Source: https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/{type}?startDate=...&endDate=...
"""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime, timedelta
from typing import Any

from backend.collectors.base import BaseCollector, logger

# Base URL without trailing slash; endpoints appended per event type.
_BASE_URL = "https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get"

# Event types to poll.
EVENT_TYPES = ("CME", "GST", "FLR", "IPS")

# Regex to parse optional "sourceLocation" strings like "N22W15", "S05E30", "N00".
_LOC_RE = re.compile(r"^([NS])(\d{2})([EW])(\d{2,3})$")


def _parse_source_location(raw: str | None) -> tuple[float | None, float | None]:
    """Parse a DONKI sourceLocation string into (latitude, longitude).

    Accepted formats: ``N22W15``, ``S05E30``.
    Returns ``(None, None)`` when the string is missing or unparseable.
    """
    if not raw:
        return None, None

    m = _LOC_RE.match(raw.strip())
    if not m:
        return None, None

    lat_sign = 1 if m.group(1) == "N" else -1
    lon_sign = 1 if m.group(3) == "E" else -1
    latitude = lat_sign * int(m.group(2))
    longitude = lon_sign * int(m.group(4))
    return float(latitude), float(longitude)


def _parse_timestamp(iso_str: str | None) -> datetime | None:
    """Parse an ISO-8601 timestamp (with optional trailing Z) into a UTC datetime.

    Returns ``None`` when *iso_str* is ``None`` or empty.
    """
    if not iso_str:
        return None

    cleaned = iso_str.strip()
    # Normalise trailing "Z" to +00:00 so ``fromisoformat`` accepts it.
    if cleaned.endswith("Z"):
        cleaned = cleaned[:-1] + "+00:00"
    return datetime.fromisoformat(cleaned).replace(tzinfo=UTC)


class DONKICollector(BaseCollector):
    """Collector for NASA DONKI space weather events (CME, GST, FLR, IPS)."""

    name = "donki"
    poll_interval = 900  # 15 minutes
    endpoint = _BASE_URL  # overridden per-type in collect()
    insert_query = """
        INSERT INTO space_weather_events (
            time, event_id, event_type, source, speed,
            latitude, longitude, description, link, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (time, event_id) DO NOTHING
    """

    # ------------------------------------------------------------------
    # collect() — fetch all four event types for the last 7 days
    # ------------------------------------------------------------------

    async def collect(self) -> list[dict[str, Any]]:
        """Fetch CME, GST, FLR, and IPS events from the past 7 days.

        Returns a flat list of parsed event dicts ready for ``format_record()``.
        """
        end_date = datetime.now(UTC).strftime("%Y-%m-%d")
        start_date = (datetime.now(UTC) - timedelta(days=7)).strftime("%Y-%m-%d")

        all_events: list[dict[str, Any]] = []

        for event_type in EVENT_TYPES:
            url = f"{_BASE_URL}/{event_type}?startDate={start_date}&endDate={end_date}"
            try:
                raw_events = await self.fetch_json(url)
            except Exception as exc:
                logger.warning("Failed to fetch %s events: %s", event_type, exc)
                continue

            if not isinstance(raw_events, list):
                continue

            for event in raw_events:
                parsed = self._parse_event(event, event_type)
                if parsed:
                    all_events.append(parsed)

        return all_events

    # ------------------------------------------------------------------
    # Internal parsing helpers
    # ------------------------------------------------------------------

    def _parse_event(self, event: dict[str, Any], event_type: str) -> dict[str, Any] | None:
        """Parse a single DONKI event object into a record dict.

        Returns ``None`` when the mandatory ``activityID`` field is missing.
        """
        event_id = event.get("activityID")
        if not event_id:
            return None

        time = _parse_timestamp(event.get("startTime"))
        source = event.get("sourceLocation")
        speed = event.get("speed")
        latitude, longitude = _parse_source_location(source)
        link = event.get("link")
        # Some event types use a notes/message field instead of explicit description.
        description = event.get("note") or event.get("message") or None

        return {
            "time": time,
            "event_id": event_id,
            "event_type": event_type,
            "source": source,
            "speed": float(speed) if speed is not None else None,
            "latitude": latitude,
            "longitude": longitude,
            "description": description,
            "link": link,
            "raw_data": event,
        }

    # ------------------------------------------------------------------
    # format_record() — dict → tuple for executemany
    # ------------------------------------------------------------------

    def format_record(self, record: dict[str, Any]) -> tuple:
        """Convert a parsed event dict to a 10-element tuple for the INSERT query.

        Order: time, event_id, event_type, source, speed,
               latitude, longitude, description, link, raw_data
        """
        return (
            record["time"],
            record["event_id"],
            record["event_type"],
            record["source"],
            record["speed"],
            record["latitude"],
            record["longitude"],
            record["description"],
            record["link"],
            json.dumps(record["raw_data"]),
        )
