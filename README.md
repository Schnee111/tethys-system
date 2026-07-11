# TETHYS — Planetary Intelligence System

> Real-time planetary monitoring dashboard aggregating data from 12 sources, detecting anomalies using statistical analysis, and visualizing global events on an interactive 3D globe.

**Live:** [tethys.web.id](https://tethys.web.id)

---

## Overview

TETHYS is a planetary intelligence system that:

- **Collects** data from 12 sources (seismic, solar wind, GOES X-ray, space weather, volcanic, atmospheric, geomagnetic, cosmic ray, ionospheric, lightning, ocean indices, tsunami warnings)
- **Detects** anomalies using MAD Z-score, Granger causality, Transfer Entropy, and Wavelet Coherence
- **Visualizes** events on a 3D globe with real-time pulse animations
- **Streams** live data via WebSocket to connected clients

Built for GEMASTIK — Software Development (Team of 3, all technical).

---

## Architecture

```
[12 Collectors] → [TimescaleDB] → [Analysis Engine] → [FastAPI + WS] → [React Globe]
      ↓                ↓                  ↓
   USGS/NOAA      Hypertables      MAD Z-score
   NASA/EONET     Continuous Aggs   Granger/TE
   Open-Meteo     Raw Ingestion     Wavelet/ARIMA
   NOAA SWPC                        Transfer Entropy
```

### Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 19 + TypeScript | Type safety, modern DX |
| 3D Globe | globe.gl (Three.js wrapper) | Best data viz globe lib |
| State | Zustand 5 | Lightweight, no boilerplate |
| Charts | Recharts | React-native, declarative |
| Backend | Python 3.12 + FastAPI | Async, high performance |
| Database | TimescaleDB (PostgreSQL) | Time-series optimized |
| WebSocket | Native WS API | Real-time event streaming |
| Deployment | Docker + Nginx + Let's Encrypt | Production-grade |

---

## Data Sources

| Source | API | Cadence | Records | Display |
|--------|-----|---------|---------|---------|
| USGS Seismic | GeoJSON feed | 60s | 2,400+ | Globe markers + LiveFeed |
| NOAA Solar Wind | SWPC DSCOVR | 300s | 10,000+ | Gauge panel + chart |
| GOES X-ray | NOAA SWPC | 60s | 39,000+ | Gauge panel + chart |
| NASA DONKI | CCMC API | 900s | 40+ | Alert list |
| NASA EONET | EONET v3 | 3600s | 31+ | Globe markers + LiveFeed |
| Open-Meteo | Forecast API | 21600s | 1,850+ | Summary card |
| NOAA Geomagnetic | SWPC Kp/Dst/AE | 300s | 500+ | Geomagnetic activity panel |
| GOES Cosmic Ray | Proton flux | 300s | 2,000+ | Cosmic ray flux chart |
| NOAA Ionospheric | GLOTEC TEC | 600s | 900+ | Ionospheric TEC map |
| WWLLN Lightning | Strike data | 300s | Real-time | Lightning strike markers |
| NOAA Ocean Indices | ENSO/NAO/PDO | 86400s | 900+ | Climate indices panel |
| NOAA Tsunami | NWS Alerts | 300s | Event-driven | Tsunami warning alerts |

---

## Features

### 3D Globe
- Real-time event markers (color-coded by domain)
- Pulse animations for earthquake impact zones
- Fly-to on event selection (auto-rotate pauses)
- Dim non-selected markers when event is selected
- Volcanic markers (torus ring) vs seismic (sphere)
- Dynamic glassmorphism panels (dark over terrain, light over space)

### Live Feed
- Real-time event streaming via WebSocket
- Time range selector (24h, 7d, 30d, All)
- Domain filter (Seismic, Volcanic, Space Weather, etc.)
- Magnitude range filter
- Event detail cards with full metadata
- Click event → globe flies to location

### Monitoring Panels
- **Solar Wind**: Speed, Density, Bt gauges + Bz direction
- **GOES X-ray**: NOAA flux class (A/B/C/M/X) + trend chart
- **Space Weather**: NASA DONKI CME alerts (expandable detail)
- **Atmosphere**: Temperature, wind from 20 global stations
- **Seismic Activity**: 24h event count line chart
- **Geomagnetic**: Kp/Dst/AE indices + storm level indicators
- **Cosmic Ray**: GOES proton flux across energy levels
- **Ionospheric**: TEC (Total Electron Content) global map
- **Lightning**: Real-time strike detection and mapping
- **Ocean Indices**: ENSO/NAO climate state tracking
- **Tsunami Warnings**: Active alerts from NOAA NWS

### Dashboard
- Dynamic glassmorphism (adapts to zoom level)
- UTC/Local time toggle
- Connection status indicator (LIVE/OFFLINE)
- Summary stats (anomalies, events, sources)
- Collapsible panel sections

---

## Scientific Methods (11 total)

| Method | Source | Purpose |
|--------|--------|---------|
| MAD Z-score | Iglewicz 1993 | Heavy-tail anomaly detection |
| Pearson + Spearman | Standard | Linear/rank correlation |
| Lag correlation | Marchitelli 2020 | Time-delayed effects [0-168h] |
| Granger causality | Granger 1969 | Directional inference |
| Benjamini-Yekutieli | BY 2001 | FDR for dependent tests |
| Effect size | — | \|r\| > 0.1 minimum threshold |
| Seismic energy | Kanamori 1977 | Σ10^(1.5M+4.8) not count |
| Transfer Entropy | Schreiber 2000 | Nonlinear information flow |
| Wavelet Coherence | Grinsted 2004 | Time-frequency correlation |
| Prewhitening | Box & Jenkins 1970 | ARIMA autocorrelation removal |
| Kp/Dst/AE indices | NOAA SWPC | Standard geomagnetic activity |

---

## Setup

### Prerequisites
- Python 3.12+
- Node.js 22+
- Docker + Docker Compose
- PostgreSQL (or TimescaleDB)

### Local Development

```bash
# Clone
git clone https://github.com/Schnee111/tethys-system.git
cd tethys-system

# Database
docker compose up -d

# Backend
python -m venv venv
source venv/bin/activate
pip install -e .
uvicorn backend.api.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Environment Variables

```env
DATABASE_URL=postgresql://tethys:***@localhost:5433/tethys
TETHYS_ENV=development
LOG_LEVEL=INFO
```

---

## Deployment

### VPS (Production)

```bash
# Build
docker compose -f docker-compose.prod.yml up -d --build

# SSL
certbot --nginx -d tethys.web.id
```

### CI/CD

Push to `main` → GitHub Actions → Auto-deploy to VPS.

---

## API Endpoints

```
System:
GET  /api/v1/health              Health check
GET  /api/v1/status              System status + collector health
GET  /api/v1/lifecycle           Database lifecycle policies

Data Sources:
GET  /api/v1/events/seismic           Seismic events (hours, min_mag, limit)
GET  /api/v1/events/solar_wind        Solar wind readings (hours, source)
GET  /api/v1/events/goes              GOES X-ray/proton/electron flux
GET  /api/v1/events/donki             NASA DONKI space weather events
GET  /api/v1/events/volcanic          Volcanic events (hours, min_vei)
GET  /api/v1/events/atmospheric       Atmospheric readings (hours, location)
GET  /api/v1/events/geomagnetic       Geomagnetic indices Kp/Dst/AE
GET  /api/v1/events/cosmic_ray        Cosmic ray proton flux
GET  /api/v1/events/ionospheric       Ionospheric TEC data
GET  /api/v1/events/lightning         Lightning strikes
GET  /api/v1/events/ocean_indices     Ocean climate indices (ENSO/NAO)
GET  /api/v1/events/tsunami_warning   Active tsunami warnings

Analysis:
GET  /api/v1/anomalies                Detected anomalies
GET  /api/v1/activity                 Activity index assessment

WebSocket:
WS   /ws/v1/live                      Real-time event stream
```

Full API documentation: [docs/API.md](docs/API.md)

---

## Project Structure

```
tethys/
├── backend/
│   ├── api/              # FastAPI routes + WebSocket
│   ├── analysis/         # Anomaly detection + correlation
│   ├── collectors/       # 12 data source collectors
│   │   ├── seismic.py
│   │   ├── solar_wind.py
│   │   ├── goes_flux.py
│   │   ├── donki.py
│   │   ├── volcanic.py
│   │   ├── atmospheric.py
│   │   ├── geomagnetic.py
│   │   ├── cosmic_ray.py
│   │   ├── ionospheric.py
│   │   ├── lightning.py
│   │   ├── ocean_indices.py
│   │   └── tsunami_warning.py
│   ├── db/               # Schema + connection pool
│   └── config.py         # Environment config
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom hooks (WebSocket)
│   │   ├── stores/       # Zustand state
│   │   ├── utils/        # Colors, glass, responsive
│   │   └── types/        # TypeScript types
│   └── dist/             # Built frontend (served by backend)
├── docs/                 # Specification documents
│   ├── API.md            # API documentation
│   ├── PROJECT.md        # Project overview
│   └── DATA-SOURCES.md   # Data source details
├── Dockerfile            # Production container
└── docker-compose.yml    # Local development
```

---

## Team

- **Daffa** — Full-stack, backend architecture, data pipeline
- **Shorekeeper** — AI assistant, system design, documentation
- **[Team Member 3]** — [Role]

---

## License

MIT

---

## Acknowledgments

- USGS Earthquake Hazards Program
- NOAA Space Weather Prediction Center
- NASA CCMC (DONKI) + EONET
- Open-Meteo
- NOAA SWPC (Geomagnetic, Ionospheric, Ocean Indices)
- WWLLN (Lightning)
- globe.gl / three-globe
