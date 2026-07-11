"""Gravity Field Collector - NASA GRACE-FO"""
import asyncio
import aiohttp
from datetime import datetime, timezone
from backend.db.connection import get_pool
from backend.collectors.base import BaseCollector

class GravityFieldCollector(BaseCollector):
    def __init__(self, pool):
        super().__init__(pool)
        self.name = "gravity_field"
        self.poll_interval = 86400  # 24 hours (monthly data)
        self.endpoint = "https://cmr.earthdata.nasa.gov/search/granules.json"
        self.short_name = "TELLUS_GRAC_MASCON_CRI_GRID_RL06.3_V4"
        self.insert_query = """
            INSERT INTO gravity_field (
                time, latitude, longitude, lwe_thickness, uncertainty
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (time, latitude, longitude) DO UPDATE SET
                lwe_thickness = EXCLUDED.lwe_thickness,
                uncertainty = EXCLUDED.uncertainty
        """
        
    async def collect(self):
        """Fetch gravity field data from NASA CMR"""
        try:
            # Query CMR for latest granules
            params = {
                'short_name': self.short_name,
                'page_size': 10,
                'sort_key': '-start_date'
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(self.endpoint, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        return await self.parse_cmr_response(data)
                    else:
                        print(f"Gravity field fetch failed: {response.status}")
                        return []
        except Exception as e:
            print(f"Gravity field error: {e}")
            return []
    
    async def parse_cmr_response(self, data):
        """Parse CMR response and extract metadata"""
        records = []
        try:
            entries = data.get('feed', {}).get('entry', [])
            
            # For now, just store metadata about available granules
            # Actual data download would require NASA Earthdata login
            for entry in entries:
                time_str = entry.get('time_start', '')
                if time_str:
                    time = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                    
                    # Store placeholder data (actual NetCDF parsing would be complex)
                    # This collector mainly tracks data availability
                    records.append({
                        'time': time,
                        'latitude': 0.0,  # Global average
                        'longitude': 0.0,
                        'lwe_thickness': 0.0,  # Would come from NetCDF
                        'uncertainty': 0.0,
                        'granule_id': entry.get('id', ''),
                        'title': entry.get('title', '')
                    })
                    
        except Exception as e:
            print(f"CMR parse error: {e}")
            
        return records
    
    def format_record(self, record):
        """Convert record dict to tuple for database insertion"""
        return (
            record['time'],
            record['latitude'],
            record['longitude'],
            record['lwe_thickness'],
            record['uncertainty']
        )
