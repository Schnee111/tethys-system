# TETHYS — Planetary Intelligence System

> Real-time planetary monitoring dashboard aggregating data from 6 sources, detecting anomalies using statistical analysis, and visualizing global events on an interactive 3D globe.

**Live:** [tethys.web.id](https://tethys.web.id)

---

## Overview

TETHYS is a planetary intelligence system that:

- **Collects** data from 6 sources (seismic, solar wind, GOES X-ray, space weather, volcanic, atmospheric)
- **Detects** anomalies using MAD Z-score, Granger causality, Transfer Entropy, and Wavelet Coherence
- **Visualizes** events on a 3D globe with real-time pulse animations
- **Streams** live data via WebSocket to connected clients

Built for GEMASTIK — Software Development (Team of 3, all technical).

---

## Architecture

```
[6 Collectors] → [TimescaleDB] → [Analysis Engine] → [FastAPI + WS] → [React Globe]
     ↓                ↓                  ↓
  USGS/NOAA      Hypertables      MAD Z-score
  NASA/EONET     Continuous Aggs   Granger/TE
  Open-Meteo     Raw Ingestion     Wavelet/ARIMA
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
- Domain filter (Seismic, Volcanic)
- Magnitude range filter
- Event detail cards with full metadata
- Click event → globe flies to location

### Monitoring Panels
- **Solar Wind**: Speed, Density, Bt gauges + Bz direction
- **GOES X-ray**: NOAA flux class (A/B/C/M/X) + trend chart
- **Space Weather**: NASA DONKI CME alerts (expandable detail)
- **Atmosphere**: Temperature, wind from 20 global stations
- **Seismic Activity**: 24h event count line chart

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
| Kp/Dst indices | NOAA SWPC | Standard geomagnetic activity |

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
DATABASE_URL=postgresql://tethys:password@localhost:5433/tethys
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
GET  /api/v1/health              Health check
GET  /api/v1/status              System status + collector health
GET  /api/v1/events/seismic      Seismic events (hours, min_mag, limit)
GET  /api/v1/solar-wind/latest   Latest solar wind reading
GET  /api/v1/solar-wind/history  Solar wind time-series (hours)
GET  /api/v1/goes/xray           GOES X-ray flux (hours)
GET  /api/v1/space-weather       DONKI space weather events
GET  /api/v1/volcanic            Volcanic events
GET  /api/v1/atmospheric         Atmospheric readings (hours)
GET  /api/v1/anomalies           Detected anomalies
GET  /api/v1/activity            Activity index assessment
WS   /ws/v1/live                 Real-time event stream
```

---

## Project Structure

```
tethys/
├── backend/
│   ├── api/           # FastAPI routes + WebSocket
│   ├── analysis/      # Anomaly detection + correlation
│   ├── collectors/    # 6 data source collectors
│   ├── db/            # Schema + connection pool
│   └── config.py      # Environment config
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks (WebSocket)
│   │   ├── stores/        # Zustand state
│   │   ├── utils/         # Colors, glass, responsive
│   │   └── types/         # TypeScript types
│   └── dist/          # Built frontend (served by backend)
├── docs/              # Specification documents
├── Dockerfile         # Production container
└── docker-compose.yml # Local development
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
- globe.gl / three-globe
