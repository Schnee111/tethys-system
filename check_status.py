import asyncio
from backend.db.connection import get_pool

async def check_status():
    pool = await get_pool()
    rows = await pool.fetch('''
        SELECT collector_name, status, last_run, records_collected 
        FROM collector_status 
        ORDER BY last_run DESC
    ''')
    
    print("\n=== Collector Status ===")
    for r in rows:
        status = r['status']
        records = r['records_collected']
        last_run = r['last_run'].strftime('%Y-%m-%d %H:%M') if r['last_run'] else 'Never'
        print(f"{r['collector_name']}: {status} ({records} records) - Last: {last_run}")
    
    await pool.close()

asyncio.run(check_status())
