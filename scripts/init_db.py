#!/usr/bin/env python3
"""Initialize database schema."""
import asyncio
from backend.db.schema import create_tables
from backend.db.connection import init_pool, close_pool
from backend.config import DATABASE_URL

async def main():
    pool = await init_pool(DATABASE_URL)
    try:
        await create_tables(pool)
        print("✓ Database schema created successfully")
    finally:
        await close_pool()

if __name__ == "__main__":
    asyncio.run(main())
