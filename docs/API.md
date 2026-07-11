# Tethys API Documentation

Base URL: `http://localhost:8000/api/v1`

## System Endpoints

### Health Check
```
GET /health
```
Returns system health status.

**Response:**
```json
{
  "status": "ok"
}
```

### System Status
```
GET /status
```
Returns detailed system status including all collector information.

**Response:**
```json
{
  "status": "operational",
  "version": "0.1.0",
  "uptime_seconds": 12345,
  "environment": "production",
  "collectors": {
    "seismic": {
      "status": "ok",
      "last_poll": "2026-07-11T20:04:34.115520+00:00",
      "records": 1234,
      "latency_ms": 150.5,
      "error": null,
      "success_count_24h": 288,
      "error_count_24h": 0,
      "last_error_time": null
    },
    "solar_wind": { ... },
    "goes_flux": { ... },
    "donki": { ... },
    "atmospheric": { ... },
    "volcanic": { ... },
    "geomagnetic": { ... },
    "cosmic_ray": { ... },
    "ionospheric": { ... },
    "lightning": { ... },
    "ocean_indices": { ... },
    "tsunami_warning": { ... }
  },
  "database": {
    "tables": {
      "seismic_events": 1234,
      "solar_wind": 567,
      "goes_flux": 890,
      "space_weather_events": 123,
      "atmospheric_data": 456,
      "volcanic_events": 78
    },
    "total_records": 3348,
    "size": "2397 MB"
  }
}
```

### Lifecycle Status
```
GET /lifecycle
```
Returns retention policies, compression policies, and continuous aggregates.

**Response:**
```json
{
  "retention_policies": [
    {
      "hypertable_name": "seismic_events",
      "drop_after": "6 months",
      "schedule_interval": "1 day",
      "next_start": "2026-07-12T00:00:00+00:00"
    }
  ],
  "compression_policies": [
    {
      "hypertable_name": "seismic_events",
      "compress_after": "7 days",
      "schedule_interval": "1 day",
      "next_start": "2026-07-12T00:00:00+00:00"
    }
  ],
  "continuous_aggregates": [
    {
      "view_name": "seismic_hourly",
      "materialization_hypertable_name": "_materialized_hypertable_1",
      "refresh_policy": {
        "start_offset": "1 month",
        "end_offset": "1 hour",
        "schedule_interval": "1 hour"
      }
    }
  ]
}
```

## Data Endpoints

All data endpoints support the following query parameters:
- `hours` (optional): Time window in hours (default: 24)
- `limit` (optional): Maximum number of records to return (default: 1000)
- `offset` (optional): Number of records to skip for pagination (default: 0)

### Seismic Events
```
GET /events/seismic
```
Returns earthquake and seismic activity data from USGS.

**Query Parameters:**
- `min_magnitude` (optional): Filter by minimum magnitude (default: 0)
- `max_depth` (optional): Filter by maximum depth in km

**Response:**
```json
{
  "count": 100,
  "events": [
    {
      "time": "2026-07-11T15:30:00+00:00",
      "event_id": "us7000kxyz",
      "magnitude": 5.2,
      "latitude": 35.6762,
      "longitude": 139.6503,
      "depth_km": 10.5,
      "place": "Tokyo, Japan",
      "type": "earthquake",
      "tsunami": 0,
      "sig": 450,
      "alert": null,
      "felt": 12,
      "cdi": 3.5,
      "mmi": 4.2,
      "mag_type": "Mww",
      "net": "us",
      "raw_data": { ... }
    }
  ]
}
```

### Solar Wind
```
GET /events/solar_wind
```
Returns solar wind data from NOAA SWPC DSCOVR satellite.

**Query Parameters:**
- `source` (optional): Filter by data source (default: "dscovr")

**Response:**
```json
{
  "count": 100,
  "readings": [
    {
      "time": "2026-07-11T15:30:00+00:00",
      "source": "dscovr",
      "density": 5.2,
      "speed": 450.3,
      "temperature": 125000.0,
      "bt": 8.5,
      "bx_gsm": -2.3,
      "by_gsm": 3.1,
      "bz_gsm": -5.2,
      "lon_gsm": 45.6,
      "lat_gsm": -12.3
    }
  ]
}
```

### GOES Flux
```
GET /events/goes
```
Returns GOES satellite X-ray, proton, and electron flux data.

**Query Parameters:**
- `flux_type` (optional): Filter by flux type ("xray", "proton", "electron")
- `energy_band` (optional): Filter by energy band

**Response:**
```json
{
  "count": 100,
  "readings": [
    {
      "time": "2026-07-11T15:30:00+00:00",
      "flux_type": "xray",
      "energy_band": "0.05-0.4nm",
      "flux": 1.23e-6,
      "satellite": "goes-18"
    }
  ]
}
```

### DONKI Space Weather Events
```
GET /events/donki
```
Returns NASA DONKI space weather events (CME, GST, FLR, etc.).

**Query Parameters:**
- `event_type` (optional): Filter by event type ("CME", "GST", "FLR", "IPS", "SEP", "HSS", "MPC", "RBE")

**Response:**
```json
{
  "count": 10,
  "events": [
    {
      "time": "2026-07-11T12:00:00+00:00",
      "event_id": "FLR-20260711-001",
      "event_type": "FLR",
      "source": "GOES-18",
      "speed": null,
      "latitude": null,
      "longitude": null,
      "description": "M5.5 X-ray flare from AR 13842",
      "link": "https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/12345",
      "raw_data": { ... }
    }
  ]
}
```

### Atmospheric Data
```
GET /events/atmospheric
```
Returns atmospheric data from Open-Meteo API.

**Query Parameters:**
- `latitude` (optional): Filter by latitude (±0.5°)
- `longitude` (optional): Filter by longitude (±0.5°)
- `category` (optional): Filter by category ("temperature", "pressure", "wind", "precipitation")

**Response:**
```json
{
  "count": 100,
  "readings": [
    {
      "time": "2026-07-11T15:00:00+00:00",
      "location_name": "Tokyo",
      "latitude": 35.6762,
      "longitude": 139.6503,
      "category": "temperature",
      "temperature": 28.5,
      "temp_min": 24.2,
      "precipitation": 0.0,
      "wind_speed": 12.3,
      "wind_dir": 180.0
    }
  ]
}
```

### Volcanic Events
```
GET /events/volcanic
```
Returns volcanic activity data from NASA EONET.

**Query Parameters:**
- `min_vei` (optional): Filter by minimum Volcanic Explosivity Index

**Response:**
```json
{
  "count": 5,
  "events": [
    {
      "time": "2026-07-11T10:00:00+00:00",
      "event_id": "EONET_12345",
      "volcano_name": "Sakurajima",
      "latitude": 31.593,
      "longitude": 130.657,
      "elevation_m": 1117,
      "event_type": "eruption",
      "vei": 2.0,
      "description": "Minor ash emission",
      "link": "https://eonet.gsfc.nasa.gov/api/v2.1/events/EONET_12345",
      "raw_data": { ... }
    }
  ]
}
```

### Geomagnetic Indices
```
GET /events/geomagnetic
```
Returns geomagnetic indices (Kp, Dst, AE) from NOAA SWPC.

**Query Parameters:**
- `index_type` (optional): Filter by index type ("kp", "dst", "ae")
- `min_value` (optional): Filter by minimum value
- `max_value` (optional): Filter by maximum value

**Response:**
```json
{
  "count": 100,
  "readings": [
    {
      "time": "2026-07-11T15:00:00+00:00",
      "index_type": "kp",
      "value": 4.0,
      "station": null
    }
  ]
}
```

### Cosmic Ray
```
GET /events/cosmic_ray
```
Returns cosmic ray data from GOES satellite proton flux.

**Query Parameters:**
- `min_energy` (optional): Filter by minimum energy level (MeV)

**Response:**
```json
{
  "count": 100,
  "readings": [
    {
      "time": "2026-07-11T15:30:00+00:00",
      "station": "goes-18",
      "energy_mev": 10.0,
      "flux_pfus": 1.23
    }
  ]
}
```

### Ionospheric TEC
```
GET /events/ionospheric
```
Returns ionospheric Total Electron Content data from NOAA SWPC GLOTEC.

**Query Parameters:**
- `latitude` (optional): Filter by latitude (±5°)
- `longitude` (optional): Filter by longitude (±5°)
- `min_tec` (optional): Filter by minimum TEC value

**Response:**
```json
{
  "count": 100,
  "readings": [
    {
      "time": "2026-07-11T15:00:00+00:00",
      "latitude": 35.0,
      "longitude": 140.0,
      "tec_value": 25.5,
      "anomaly": 2.3,
      "hmF2": 320.5,
      "NmF2": 1.23e12,
      "quality_flag": 0
    }
  ]
}
```

### Lightning
```
GET /events/lightning
```
Returns lightning strike data from WWLLN.

**Query Parameters:**
- `latitude` (optional): Filter by latitude (±1°)
- `longitude` (optional): Filter by longitude (±1°)
- `min_energy` (optional): Filter by minimum energy

**Response:**
```json
{
  "count": 100,
  "strikes": [
    {
      "time": "2026-07-11T15:30:15+00:00",
      "latitude": 35.6762,
      "longitude": 139.6503,
      "energy": 125.5,
      "station_count": 8
    }
  ]
}
```

### Ocean Indices
```
GET /events/ocean_indices
```
Returns ocean climate indices (ENSO, NAO, etc.) from NOAA CPC.

**Query Parameters:**
- `index_type` (optional): Filter by index type ("enso", "nao", "pdo", "amo")

**Response:**
```json
{
  "count": 10,
  "readings": [
    {
      "time": "2026-07-01T00:00:00+00:00",
      "index_type": "enso",
      "value": 0.8,
      "anomaly": 0.5,
      "classification": "el_nino"
    }
  ]
}
```

### Tsunami Warnings
```
GET /events/tsunami_warning
```
Returns tsunami warnings from NOAA NWS.

**Query Parameters:**
- `alert_level` (optional): Filter by alert level ("warning", "watch", "advisory", "information")

**Response:**
```json
{
  "count": 0,
  "warnings": []
}
```

## WebSocket

### Live Data Stream
```
WS /ws/v1/live
```
Real-time WebSocket connection for live data updates.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/v1/live');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

**Message Format:**
```json
{
  "type": "seismic",
  "data": {
    "time": "2026-07-11T15:30:00+00:00",
    "event_id": "us7000kxyz",
    "magnitude": 5.2,
    ...
  },
  "timestamp": "2026-07-11T15:30:01+00:00"
}
```

**Message Types:**
- `seismic` - New earthquake events
- `solar_wind` - New solar wind readings
- `goes_flux` - New GOES flux readings
- `donki` - New space weather events
- `atmospheric` - New atmospheric readings
- `volcanic` - New volcanic events
- `geomagnetic` - New geomagnetic index readings
- `cosmic_ray` - New cosmic ray readings
- `ionospheric` - New ionospheric TEC readings
- `lightning` - New lightning strikes
- `ocean_indices` - New ocean index readings
- `tsunami_warning` - New tsunami warnings
- `heartbeat` - Connection keepalive (every 30 seconds)

## Error Responses

All endpoints return standard HTTP error codes:

- `400 Bad Request` - Invalid query parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Database connection error

**Error Response Format:**
```json
{
  "error": "Error message",
  "message": "Detailed description",
  "type": "ErrorType"
}
```

## Rate Limiting

Currently no rate limiting is implemented. For production use, consider implementing rate limiting middleware.

## Authentication

Currently no authentication is required. For production use, implement API key or OAuth2 authentication.

## Data Retention

Data is automatically managed by TimescaleDB retention policies:
- High-frequency data (solar wind, GOES): 6 months
- Event data (seismic, volcanic, DONKI): 2 years
- Climate data (ocean indices): 5 years

## Examples

### Get recent earthquakes
```bash
curl "http://localhost:8000/api/v1/events/seismic?hours=1&min_magnitude=4.0"
```

### Get current geomagnetic activity
```bash
curl "http://localhost:8000/api/v1/events/geomagnetic?hours=3&index_type=kp"
```

### Get system status
```bash
curl "http://localhost:8000/api/v1/status"
```

### Connect to live data stream
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/v1/live');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'seismic' && data.data.magnitude > 5.0) {
    console.log('Major earthquake:', data.data);
  }
};
```
