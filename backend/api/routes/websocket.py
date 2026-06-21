"""Tethys — WebSocket Live Event Stream.

Provides real-time event broadcasting to connected clients.
- Application-level ping/pong keepalive (browser WS can't send protocol pings)
- sync_request handling (client reconnect or tab visibility)
- Rate-limited broadcast (max 1 per type per 2 seconds)
"""

import asyncio
import contextlib
import json
import logging
import time
from datetime import UTC, datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()

# Connected clients with last pong time
connected_clients: dict[WebSocket, float] = {}

# Broadcast rate limiting
_broadcast_cooldown: dict[str, float] = {}
BROADCAST_COOLDOWN_SECONDS = 2.0


async def broadcast_event(event: dict) -> None:
    """Send event to all connected clients. Rate-limited per event type.

    Called by collectors after successful store — NOT by a polling loop.
    """
    event_type = event.get("type", "unknown")
    now = time.time()

    last_broadcast = _broadcast_cooldown.get(event_type, 0)
    if now - last_broadcast < BROADCAST_COOLDOWN_SECONDS:
        return

    _broadcast_cooldown[event_type] = now

    message = json.dumps(event, default=str)
    disconnected = set()

    for client in connected_clients:
        try:
            await client.send_text(message)
        except Exception:
            disconnected.add(client)

    for client in disconnected:
        connected_clients.pop(client, None)


async def websocket_heartbeat() -> None:
    """Background task: ping all clients every 30 seconds.

    If no pong within 60 seconds, close dead connection.
    Per the 75% rule: heartbeat = 0.75 * shortest_proxy_timeout.
    Nginx default 60s → heartbeat every 45s. We use 30s for safety.
    """
    while True:
        await asyncio.sleep(30)
        now = time.time()
        dead = []

        for ws, last_pong in connected_clients.items():
            if now - last_pong > 60:
                dead.append(ws)
            else:
                try:
                    await ws.send_json({"type": "ping"})
                except Exception:
                    dead.append(ws)

        for ws in dead:
            connected_clients.pop(ws, None)
            with contextlib.suppress(Exception):
                await ws.close()


@router.websocket("/ws/v1/live")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Live event stream endpoint.

    Messages:
        Client → Server:
            {"type": "pong"} — keepalive response
            {"type": "sync_request"} — request last 24h of data
        Server → Client:
            {"type": "ping"} — keepalive
            {"type": "sync_response", "data": {...}} — historical data
            {"type": "<collector_name>", "data": [...]} — live events
    """
    await websocket.accept()
    connected_clients[websocket] = time.time()
    logger.info(f"WebSocket client connected. Total: {len(connected_clients)}")

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "pong":
                connected_clients[websocket] = time.time()

            elif data.get("type") == "sync_request":
                from backend.db.connection import get_pool

                pool = await get_pool()
                recent = await _get_recent_events(pool, hours=24)
                await websocket.send_json(
                    {
                        "type": "sync_response",
                        "data": recent,
                        "timestamp": datetime.now(UTC).isoformat(),
                    }
                )

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
    finally:
        connected_clients.pop(websocket, None)
        logger.info(f"WebSocket client disconnected. Total: {len(connected_clients)}")


async def _get_recent_events(pool, hours: int = 24) -> dict:
    """Get recent events from all tables for WebSocket sync."""
    from datetime import timedelta

    result = {}
    interval = timedelta(hours=hours)

    queries = {
        "seismic": (
            "SELECT * FROM seismic_events "
            "WHERE time > NOW() - $1::interval "
            "ORDER BY time DESC LIMIT 500"
        ),
        "solar_wind": (
            "SELECT * FROM solar_wind "
            "WHERE time > NOW() - $1::interval "
            "ORDER BY time DESC LIMIT 500"
        ),
        "goes": (
            "SELECT * FROM goes_flux WHERE time > NOW() - $1::interval ORDER BY time DESC LIMIT 500"
        ),
        "space_weather": (
            "SELECT * FROM space_weather_events "
            "WHERE time > NOW() - $1::interval "
            "ORDER BY time DESC LIMIT 100"
        ),
    }

    async with pool.acquire() as conn:
        for key, query in queries.items():
            try:
                rows = await conn.fetch(query, interval)
                result[key] = [dict(r) for r in rows]
            except Exception as e:
                logger.warning(f"Failed to fetch {key} for sync: {e}")
                result[key] = []

    return result
