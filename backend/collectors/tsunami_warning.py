"""Tsunami Warning Collector - NOAA National Weather Service"""
import asyncio
import aiohttp
from datetime import datetime, timezone
from backend.db.connection import get_pool
from backend.collectors.base import BaseCollector

class TsunamiWarningCollector(BaseCollector):
    def __init__(self, pool):
        super().__init__(pool)
        self.name = "tsunami_warning"
        self.poll_interval = 300  # 5 minutes
        self.endpoint = "https://api.weather.gov/alerts?message_type=alert&event=Tsunami%20Warning"
        self.insert_query = """
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
        """
        
    async def collect(self):
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
                        data = await response.json()
                        return self.parse_json(data)
                    else:
                        print(f"Tsunami warning fetch failed: {response.status}")
                        return []
        except Exception as e:
            print(f"Tsunami warning error: {e}")
            return []
    
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
                    'parameters': {},
                    'time': datetime.now(timezone.utc)
                }
                
                warnings.append(warning)
                
        except Exception as e:
            print(f"JSON parse error: {e}")
            
        return warnings
    
    def format_record(self, record):
        """Convert record dict to tuple for database insertion"""
        return (
            record['event_id'],
            record['event_type'],
            record['alert_level'],
            record['headline'],
            record['description'],
            record['instruction'],
            record['area_desc'],
            record['effective'] if record['effective'] else None,
            record['expires'] if record['expires'] else None,
            record['sender_name'],
            record['parameters'],
            record['time']
        )
