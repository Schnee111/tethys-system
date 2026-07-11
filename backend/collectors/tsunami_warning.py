"""Tsunami Warning Collector - NOAA National Weather Service"""
import asyncio
import aiohttp
from datetime import datetime, timezone
from backend.db.connection import get_pool

class TsunamiWarningCollector:
    def __init__(self):
        self.name = "tsunami_warning"
        self.interval = 300  # 5 minutes
        self.endpoint = "https://api.weather.gov/alerts?message_type=alert&event=Tsunami%20Warning"
        
    async def fetch_data(self):
        """Fetch tsunami warnings from NWS"""
        try:
            timeout = aiohttp.ClientTimeout(total=30)
            headers = {
                'User-Agent': 'Tethys Planetary Monitor (research project)',
                'Accept': 'application/geo+json'
            }
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(self.endpoint, headers=headers) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        print(f"Tsunami warning fetch failed: {response.status}")
                        return None
        except Exception as e:
            print(f"Tsunami warning error: {e}")
            return None
    
    def parse_json(self, data):
        """Parse NWS alerts JSON"""
        warnings = []
        try:
            features = data.get('features', [])
            for feature in features:
                properties = feature.get('properties', {})
                geometry = feature.get('geometry', {})
                
                # Extract coordinates if available
                lat = lon = None
                if geometry and geometry.get('type') == 'Point':
                    coords = geometry.get('coordinates', [])
                    if len(coords) >= 2:
                        lon, lat = coords[0], coords[1]
                
                warning = {
                    'event_id': properties.get('id', ''),
                    'event_type': properties.get('event', ''),
                    'alert_level': properties.get('severity', ''),
                    'headline': properties.get('headline', ''),
                    'description': properties.get('description', ''),
                    'instruction': properties.get('instruction', ''),
                    'area_desc': properties.get('areaDesc', ''),
                    'effective': properties.get('effective'),
                    'expires': properties.get('expires'),
                    'sender_name': properties.get('senderName', ''),
                    'latitude': lat,
                    'longitude': lon,
                    'parameters': {}
                }
                
                warnings.append(warning)
                
        except Exception as e:
            print(f"JSON parse error: {e}")
            
        return warnings
    
    async def save_to_db(self, warnings):
        """Save warnings to database"""
        pool = await get_pool()
        
        for warning in warnings:
            try:
                await pool.execute('''
                    INSERT INTO tsunami_warnings (
                        event_id, event_type, alert_level, headline,
                        description, instruction, area_desc,
                        effective, expires, sender_name, parameters,
                        created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (event_id) DO UPDATE SET
                        alert_level = EXCLUDED.alert_level,
                        headline = EXCLUDED.headline,
                        description = EXCLUDED.description,
                        instruction = EXCLUDED.instruction,
                        expires = EXCLUDED.expires,
                        updated_at = NOW()
                ''',
                    warning['event_id'],
                    warning['event_type'],
                    warning['alert_level'],
                    warning['headline'],
                    warning['description'],
                    warning['instruction'],
                    warning['area_desc'],
                    warning['effective'] if warning['effective'] else None,
                    warning['expires'] if warning['expires'] else None,
                    warning['sender_name'],
                    warning['parameters'],
                    datetime.now(timezone.utc)
                )
            except Exception as e:
                print(f"DB save error: {e}")
        
        await pool.close()
    
    async def run(self):
        """Main collector loop"""
        print(f"Starting {self.name} collector...")
        
        while True:
            try:
                json_data = await self.fetch_data()
                
                if json_data:
                    warnings = self.parse_json(json_data)
                    print(f"Fetched {len(warnings)} tsunami warnings")
                    
                    if warnings:
                        await self.save_to_db(warnings)
                        print(f"Saved {len(warnings)} warnings to database")
                
                await asyncio.sleep(self.interval)
                
            except Exception as e:
                print(f"Collector error: {e}")
                await asyncio.sleep(self.interval)

if __name__ == "__main__":
    collector = TsunamiWarningCollector()
    asyncio.run(collector.run())
