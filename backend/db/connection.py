"""Tethys — Database Connection Pool.

Connection pool limits prevent PostgreSQL OOM on 4GB VPS.
With 6 collectors + 2 Uvicorn workers + analysis scheduler,
unbounded connections could exhaust PostgreSQL's max_connections (100).
"""

import asyncpg

_pool: asyncpg.Pool | None = None


async def init_pool(database_url: str) -> asyncpg.Pool:
    """Initialize the connection pool. Call once at startup."""
    global _pool
    # Disable SSL for local dev (TimescaleDB in Docker has SSL off)
    # asyncpg tries SSL by default, causing ConnectionResetError
    ssl_mode = "disable" if ("localhost" in database_url or "127.0.0.1" in database_url) else None

    _pool = await asyncpg.create_pool(
        database_url,
        min_size=2,
        max_size=15,  # 6 collectors + 2 workers + analysis + headroom
        command_timeout=30,
        ssl=ssl_mode,
    )
    return _pool


async def get_pool() -> asyncpg.Pool:
    """Get the connection pool. Raises if not initialized."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_pool() first.")
    return _pool


async def close_pool() -> None:
    """Close the connection pool. Call at shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
