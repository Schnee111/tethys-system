"""Tethys — Base Collector Class.

All data collectors inherit from this. Provides:
- Polling loop with time-drift correction
- Exponential backoff on failures
- Bulk insert with executemany
- Delta filter for WebSocket broadcast (no backfill flood)
- Health status logging
- Raw ingestion event sourcing
"""

import asyncio
import json
import logging
import time
from abc import ABC, abstractmethod
from datetime import UTC, datetime

import aiohttp
import asyncpg

logger = logging.getLogger(__name__)

# WebSocket broadcast callback — set by the API server at startup
_broadcast_callback = None


def set_broadcast_callback(callback) -> None:
    """Register the WebSocket broadcast function. Called by API server."""
    global _broadcast_callback
    _broadcast_callback = callback


async def broadcast_event(event: dict) -> None:
    """Send event to all connected WebSocket clients."""
    if _broadcast_callback:
        await _broadcast_callback(event)


class BaseCollector(ABC):
    """Base class for all data collectors.

    Subclasses must define:
        name: str — collector identifier (e.g., 'seismic')
        poll_interval: int — seconds between polls
        endpoint: str — API endpoint URL
        insert_query: str — SQL for upsert

    And implement:
        collect() -> list[dict] — fetch and parse API response
        format_record(record) -> tuple — dict to SQL tuple
    """

    name: str = ""
    poll_interval: int = 60
    endpoint: str = ""
    timeout: int = 30
    insert_query: str = ""

    def __init__(self, pool: asyncpg.Pool) -> None:
        """Pool must be injected — collectors don't create pools."""
        self.pool = pool
        self.last_poll_time: datetime | None = None
        self.total_records: int = 0
        self.errors_24h: int = 0
        self.last_status: str = "pending"
        self.success_count: int = 0
        self.error_count: int = 0
        self.last_error: str | None = None
        self.last_error_time: datetime | None = None

    @abstractmethod
    async def collect(self) -> list[dict]:
        """Fetch data from API, return list of parsed records."""
        ...

    @abstractmethod
    def format_record(self, record: dict) -> tuple:
        """Convert record dict to tuple matching insert_query placeholders."""
        ...

    async def fetch_json(
        self,
        url: str,
        headers: dict | None = None,
        content_type: str | None = "application/json",
    ) -> dict | list:
        """Fetch JSON from URL with timeout, stores raw response in database, and returns parsed response."""
        async with (
            aiohttp.ClientSession() as session,
            session.get(
                url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=self.timeout),
            ) as resp,
        ):
            resp.raise_for_status()
            data = await resp.json(content_type=content_type)

            # Store raw response in database
            async with self.pool.acquire() as conn:
                await self.store_raw(conn, data, resp.status, url=url)

            return data

    async def store_raw(
        self,
        conn: asyncpg.Connection,
        response_body: dict | list,
        response_code: int = 200,
        url: str | None = None,
    ) -> None:
        """Store raw API response for event sourcing (debugging, reprocessing)."""
        body_json = (
            json.dumps(response_body) if not isinstance(response_body, str) else response_body
        )
        request_url = url or self.endpoint
        try:
            await conn.execute(
                """
                INSERT INTO raw_ingestion (time, source, endpoint, response_code, response_body)
                VALUES ($1, $2, $3, $4, $5)
                """,
                datetime.now(UTC),
                self.name,
                request_url,
                response_code,
                body_json,
            )
        except Exception as e:
            logger.warning(f"Failed to store raw ingestion for {self.name}: {e}")

    async def store(self, records: list[dict]) -> int:
        """Bulk insert with upsert. Uses executemany for performance.

        Override in subclass if multiple queries needed (e.g., SolarWind).
        Filters out records with None time to prevent hypertable violations.
        """
        if not records:
            return 0
        # Safety: skip records with NULL time (violates TimescaleDB hypertable constraint)
        valid = [r for r in records if r.get("time") is not None]
        skipped = len(records) - len(valid)
        if skipped > 0:
            logger.warning(f"{self.name}: skipped {skipped} records with NULL time")
        if not valid:
            return 0
        async with self.pool.acquire() as conn, conn.transaction():
            values = [self.format_record(r) for r in valid]
            await conn.executemany(self.insert_query, values)
            return len(values)

    async def log_status(
        self, status: str, count: int, elapsed: float, error: str | None = None
    ) -> None:
        """Log collector health to collector_status table."""
        self.last_status = status
        self.total_records += count
        
        if error:
            self.last_error = error
            self.last_error_time = datetime.now(UTC)
        
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO collector_status (time, collector, status,
                        records_count, latency_ms, error_message)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    """,
                    datetime.now(UTC),
                    self.name,
                    status,
                    count,
                    elapsed * 1000,
                    error,
                )
        except Exception as e:
            logger.error(f"Failed to log status for {self.name}: {e}")

    async def broadcast_new_records(self, records: list[dict]) -> None:
        """Broadcast only NEW records via WebSocket (delta filter).

        After server restart, collectors fetch 7-day files with thousands of rows.
        Broadcasting all of them would flood WebSocket and crash browser memory.
        Solution: only broadcast records newer than last_poll_time.
        """
        if not self.last_poll_time:
            # First run: don't broadcast historical backfill
            self.last_poll_time = datetime.now(UTC)
            return

        new_records = [r for r in records if r.get("time") and r["time"] > self.last_poll_time]
        self.last_poll_time = datetime.now(UTC)

        if new_records:
            await broadcast_event(
                {
                    "type": self.name,
                    "data": new_records,
                    "count": len(new_records),
                    "timestamp": datetime.now(UTC).isoformat(),
                }
            )

    async def run(self) -> None:
        """Main loop with time-drift correction and exponential backoff.

        Runs forever. Each cycle: collect → store → broadcast → sleep.
        On failure: exponential backoff up to 5 minutes.
        """
        consecutive_errors = 0
        max_backoff = 300  # 5 minutes

        logger.info(f"Starting collector: {self.name} (interval={self.poll_interval}s)")

        while True:
            start = time.time()
            try:
                records = await self.collect()
                count = await self.store(records)
                await self.broadcast_new_records(records)
                await self.log_status("ok", count, time.time() - start)
                consecutive_errors = 0
                self.success_count += 1
                if count > 0:
                    logger.info(f"{self.name}: stored {count} records")

            except Exception as e:
                consecutive_errors += 1
                self.errors_24h += 1
                self.error_count += 1
                error_msg = f"{type(e).__name__}: {e}"
                await self.log_status("error", 0, time.time() - start, error_msg)
                logger.error(f"{self.name} error (#{consecutive_errors}): {error_msg}")

            # Time-drift correction + exponential backoff
            elapsed = time.time() - start
            base_sleep = max(0, self.poll_interval - elapsed)

            if consecutive_errors > 0:
                backoff = min(2**consecutive_errors * 10, max_backoff)
                sleep_time = max(base_sleep, backoff)
            else:
                sleep_time = base_sleep

            await asyncio.sleep(sleep_time)

    def get_health_summary(self) -> dict:
        """Return a summary of collector health metrics."""
        return {
            "name": self.name,
            "status": self.last_status,
            "total_records": self.total_records,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "last_error": self.last_error,
            "last_error_time": self.last_error_time.isoformat() if self.last_error_time else None,
            "poll_interval": self.poll_interval,
        }
