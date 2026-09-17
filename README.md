# TETHYS — Planetary Intelligence System

> Autonomous, real-time planetary observatory aggregating multi-sphere Earth and space weather telemetry, detecting cross-domain compound anomalies through statistical and causal inference, and rendering global dynamics on an interactive 3D geospatial digital twin.

[![Live Dashboard](https://img.shields.io/badge/Live_Demo-tethys.web.id-00F5FF?style=flat-square&logo=firefox-browser&logoColor=white)](https://tethys.web.id)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Python 3.12+](https://img.shields.io/badge/Python-3.12+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![TimescaleDB](https://img.shields.io/badge/TimescaleDB-PostgreSQL_16-FDB515?style=flat-square&logo=postgresql&logoColor=white)](https://timescale.com)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![MapLibre GL](https://img.shields.io/badge/MapLibre_GL-v5_Globe-3969EC?style=flat-square&logo=maplibre&logoColor=white)](https://maplibre.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

**[Explore Live Observatory](https://tethys.web.id)** • **[API Documentation](docs/API.md)** • **[Scientific Framework](docs/SCIENCE.md)** • **[System Architecture](docs/PROJECT.md)** • **[Infrastructure](docs/INFRASTRUCTURE.md)**

---

## Overview

Planetary subsystems do not operate in isolation. Solar flare coronal mass ejections perturb Earth's magnetosphere, geomagnetic storms induce fluctuations in ionospheric Total Electron Content (TEC), and atmospheric pressure gradients couple with lithospheric stress distributions. 

Despite these physical couplings, planetary monitoring remains deeply fragmented across siloed institutional services: USGS tracks seismicity, NOAA SWPC monitors space weather, NASA DONKI catalogues solar transients, and atmospheric agencies maintain disconnected meteorological stations. Cross-domain correlation research exists (*e.g., Marchitelli et al., Nature Sci. Rep. 2020*), but real-time multi-sphere observatory pipelines have been inaccessible to open-source systems.

**TETHYS** bridges this divide. It is a full-stack, distributed planetary telemetry platform that autonomously ingests 12+ live data feeds into TimescaleDB hypertables, executes automated statistical anomaly detection and causal discovery pipelines, and streams real-time spatial events to a high-performance 3D WebGL globe.

> **Research Disclaimer**: TETHYS is an observational research and statistical analysis platform, **not an earthquake or disaster prediction system**. Correlation does not imply causation. Detected anomalies represent mathematical deviations from empirical baselines, not guaranteed alerts. Data must not be used as the sole basis for life-safety decisions.

---

## System Architecture

```
   ┌────────────────────────────────────────────────────────────────────────┐
   │                  TELEMETRY INGESTION LAYER (12 SOURCES)               │
   │  USGS Seismic • NOAA SWPC Solar Wind • GOES-16/18 X-Ray/Proton Flux    │
   │  NASA DONKI CME • GLOTEC Ionospheric TEC • Geomagnetic (Kp/Dst)        │
   │  Open-Meteo Atmosphere • GVP Volcanism • NOAA Tsunami • Ocean (ENSO)   │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │ Async Polling (1m – 24h)
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                    PERSISTENCE & STORAGE (TIMESCALEDB)                 │
   │  PostgreSQL 16 Hypertables (Chunk Interval: 1h – 1d)                  │
   │  Continuous Materialized Aggregates (Hourly/Daily Rollups)             │
   │  Missing-Data Sentinel Filters (NOAA -9999 Guards)                     │
   └─────────────────┬──────────────────────────────────┬───────────────────┘
                     │                                  │
                     ▼                                  ▼
   ┌──────────────────────────────────┐   ┌─────────────────────────────────┐
   │    ANALYTICAL INFERENCE ENGINE   │   │     SERVING & STREAMING         │
   │  • MAD-Based Robust Z-Scores     │   │  • FastAPI Asynchronous Engine  │
   │  • Box-Jenkins ARIMA Prewhiten   │   │  • Broadcast WebSockets Engine  │
   │  • Multi-Lag Cross-Correlation   │   │  • Heartbeat & Connection Pool  │
   │  • Benjamini-Yekutieli FDR       │   │  • RESTful Endpoints (/api/v1)  │
   │  • Granger Causality F-Tests     │   └────────────────┬────────────────┘
   │  • Transfer Entropy (pyinform)   │                    │
   │  • Wavelet Coherence (pycwt)     │                    │ WebSocket / JSON
   │  • Compound Cascade Detection    │                    │ (Native Protobuf-ready)
   │  • State Pattern Memory Catalog  │                    ▼
   │  • Natural Language Narrative    │   ┌─────────────────────────────────┐
   └──────────────────────────────────┘   │     CLIENT PRESENTATION LAYER   │
                                          │  • MapLibre GL JS v5 3D Globe   │
                                          │  • Esri World Imagery Basemap   │
                                          │  • Dynamic Glassmorphism HUD    │
                                          │  • Zustand 5 State Architecture │
                                          │  • Recharts Telemetry Visuals   │
                                          └─────────────────────────────────┘
```

---

## Key Capabilities

- **Multi-Sphere Ingestion Pipeline**: 12 dedicated asynchronous collectors continuously polling seismic, solar, magnetospheric, ionospheric, atmospheric, oceanic, and volcanic feeds with automated reconnect and backoff.
- **Robust Outlier Detection**: Replaces standard Gaussian Z-scores with Median Absolute Deviation (MAD) scaling, preventing false alarms on heavy-tailed power-law events (solar flares, earthquake magnitudes).
- **Time-Series Prewhitening & Lag Analysis**: Eliminates diurnal cycle confounding via first-order differencing and ARIMA prewhitening before evaluating cross-domain lag correlations across windows of 0–168 hours.
- **Directional & Non-Linear Causal Discovery**: Evaluates predictive precedence via bivariate Granger Causality and quantifies non-linear information flow using Schreiber Transfer Entropy.
- **Time-Frequency Wavelet Coherence**: Deconstructs localized cross-wavelet power and relative phase angles using Continuous Morlet Wavelets to identify transient phase couplings across planetary phenomena.
- **Pattern Memory & Compound Anomaly Detection**: Catalogues multi-variable state vectors via categorical binning to match recurring planetary signatures ("observed *N* times historically") and isolates simultaneous multi-domain cascade breaches.
- **Automated Situational Narrative ("Tethys Speaks")**: On-the-fly natural language generation translating complex multi-variate statistical anomalies and activity states into clear situational intelligence debriefs.
- **True 3D Geospatial Digital Twin**: Hardware-accelerated 3D globe rendered via MapLibre GL JS v5, atmospheric scattering shaders, real-time epicenter shockwave animations, and high-resolution Esri satellite raster tiles.
- **Deterministic Offline Demo Mode**: Fully functional offline simulation engine delivering mathematically consistent synthetic telemetry for isolated development, automated testing, and air-gapped evaluation.

---

## Telemetry Ingestion Catalog

| Domain | Institutional Source | Protocol / Feed | Cadence | Stored Telemetry & Metrics |
| :--- | :--- | :--- | :--- | :--- |
| **Seismicity** | USGS Earthquake Hazards | GeoJSON Real-Time | 60s | Magnitude, coordinates, depth, significance, PAGER alert level |
| **Solar Wind** | NOAA SWPC (DSCOVR/ACE) | JSON Plasma/Mag | 300s | Bulk speed ($km/s$), proton density ($p/cm^3$), temperature, $B_z$ / $B_t$ ($nT$) |
| **Solar Radiation** | NOAA SWPC (GOES-16/18) | JSON Flux Primary | 60s | X-ray flux (0.05–0.4 nm, 0.1–0.8 nm), flare classification (A/B/C/M/X) |
| **Space Weather** | NASA CCMC DONKI | REST API | 900s | Coronal Mass Ejections (CME), interplanetary shock speeds, half-angles |
| **Ionosphere** | NOAA SWPC GLOTEC | GeoJSON 2D URT | 600s | Total Electron Content (TEC in TECU), hmF2, NmF2 peak electron densities |
| **Geomagnetism** | NOAA SWPC / Kyoto WDC | JSON / Text Feed | 300s | Planetary K-index ($K_p$), Disturbance Storm Time ($Dst$), Auroral Electrojet ($AE$) |
| **Cosmic Radiation** | NOAA SWPC (GOES EPS) | JSON Proton Flux | 300s | High-energy solar proton flux ($>10\text{ MeV}, >50\text{ MeV}, >100\text{ MeV}$) |
| **Atmosphere** | Open-Meteo Global | REST Forecast Feed | 6h | Surface temperature, MSL pressure, wind vectors across 20 reference stations |
| **Volcanism** | Smithsonian GVP / EONET | GeoJSON Active | 1h | Volcano name, elevation, alert level, summit coordinates, eruption status |
| **Tsunami Alerts** | NOAA NWS PTWC/NTWC | CAP/GeoJSON Feeds | 300s | Active warning polygons, threat classifications, affected coastal zones |
| **Oceanic Oscillations**| NOAA CPC | ASCII Index Stream | Monthly | Oceanic Niño Index (ONI), ENSO phase classification, anomaly offsets |
| **Geopotential** | NASA CMR (GRACE-FO) | REST Metadata API | Daily | Tellus mascon availability, spherical harmonic gravity anomalies |

---

## Scientific Foundations & Mathematical Framework

### 1. Robust Anomaly Detection (MAD-Based Z-Score)
Geophysical events (earthquake seismic moments, solar X-ray flares) follow power-law distributions (Gutenberg-Richter, Pareto) where standard Gaussian mean and variance estimators break down:

$$\text{MAD} = \text{median}\left(\left| x_i - \tilde{x} \right|\right), \quad \text{Robust } Z = 0.6745 \cdot \frac{x_i - \tilde{x}}{\text{MAD}}$$

The $0.6745$ scaling factor establishes parity with standard deviation for normally distributed subsets while remaining immune to extreme leverage points (*Iglewicz & Hoaglin, 1993; Leys et al., 2013*).

### 2. Physical Energy Scaling
For lithospheric comparisons, raw event frequencies are superseded by cumulative seismic energy release derived from the Gutenberg-Richter relation (*Kanamori, 1977*):

$$\log_{10} E = 1.5 M_w + 4.8 \implies E = 10^{1.5 M_w + 4.8} \text{ Joules}$$

### 3. Stationary Prewhitening & Lag Analysis
To prevent spurious correlation induced by common diurnal insolation and seasonal periodicities, telemetry series are prewhitened using first-order backward differencing ($\Delta x_t = x_t - x_{t-1}$) and fitted Box-Jenkins ARIMA models before testing cross-domain lags across $\tau \in [0, 6, 12, 24, 48, 72, 120, 168]$ hours.

### 4. Benjamini-Yekutieli False Discovery Rate (FDR) Control
Simultaneous cross-correlation over multiple lag horizons generates dependent hypothesis sets. TETHYS enforces Benjamini-Yekutieli FDR control (*BY, 2001*), guaranteeing asymptotic bound preservation under arbitrary statistical dependence:

$$P_{(k)} \le \frac{k}{m \cdot \sum_{i=1}^{m} \frac{1}{i}} \cdot Q^*$$

### 5. Transfer Entropy & Wavelet Coherence
- **Information Theoretic Flow**: Schreiber Transfer Entropy ($T_{X \to Y}$) quantifies directional reduction in uncertainty without assuming linear dynamics:
  $$T_{X \to Y} = \sum p(y_{t+1}, y_t^{(k)}, x_t^{(l)}) \log_2 \frac{p(y_{t+1} \mid y_t^{(k)}, x_t^{(l)})}{p(y_{t+1} \mid y_t^{(k)})}$$
- **Time-Frequency Localization**: Continuous Wavelet Transform (CWT) using Morlet wavelets computes localized cross-wavelet power spectra and phase-locking angles ($\theta_t$) to isolate transient frequency coupling (*Grinsted et al., 2004*).

---

## Spatial User Interface & Glassmorphism HUD

The frontend delivers a zero-clutter, responsive command console arranged into three purpose-built operational spaces:

1. **LIVE (Operational Observatory)**:
   - Full-viewport 3D MapLibre globe projection with progressive Esri satellite imagery.
   - Dynamic seismic epicenter pulse rings, volcanic caldera markers, and space weather gauge arrays.
   - Streaming chronological telemetry feed with sub-second WebSocket event updates.
2. **INTELLIGENCE (Analytical Deep Dive)**:
   - Automated natural language situational report generated by the narrative engine.
   - Composite multi-sphere planetary activity index gauge.
   - High-severity anomaly feed with historical MAD $Z$-score distributions.
   - Statistically significant cross-domain correlation cards with $p$-values, effect sizes, and time lags.
3. **DATA (Telemetry Inspector)**:
   - Granular telemetry inspection panels covering all active collectors.
   - Multi-metric time-series curves with adjustable lookback windows (24h, 7d, 30d).
   - Domain-specific filtering and raw scientific value inspection.

---

## Technical Stack

| Tier | Component | Technology | Selection Rationale |
| :--- | :--- | :--- | :--- |
| **Frontend** | Framework | React 19 + TypeScript 5.8 | Modern concurrent rendering and strict type safety |
| | Bundler & DX | Vite 6 | Sub-second HMR and optimized production asset chunking |
| | Styling & HUD | Tailwind CSS v4 + Motion | Hardware-accelerated transitions and glassmorphism styling |
| | 3D Geospatial | MapLibre GL JS v5 | Native WebGL 3D globe projection without Three.js overhead |
| | Telemetry Viz | Recharts 3.8 | Composable SVG data visualizations for high-density series |
| | State Management | Zustand 5 | Minimal footprint reactive store decoupled from render tree |
| **Backend** | API Engine | Python 3.12 + FastAPI 0.115 | Fully asynchronous ASGI engine with native OpenAPI generation |
| | Async Driver | asyncpg 0.30 | High-throughput binary PostgreSQL driver for raw performance |
| | Numeric & Causal | NumPy, SciPy, Statsmodels | Industrial mathematical and statistical inference routines |
| | Advanced Analysis | PyInform & PyCWT | Information-theoretic Transfer Entropy and Wavelet Coherence |
| **Database** | Primary Store | TimescaleDB (PostgreSQL 16) | Automatic hypertable chunking and continuous aggregates |
| **DevOps** | Containerization | Docker & Docker Compose | Hermetic multi-stage build environments with minimal attack surface |
| | Ingress Proxy | Nginx (Alpine) + Certbot | SSL/TLS termination, rate limiting, and WebSocket proxy upgrades |
| | CI/CD Pipeline | GitHub Actions | Automated linting, typechecking, build verification, and deployment |

---

## Project Layout

```
tethys/
├── backend/
│   ├── analysis/                 # Mathematical & inference engine
│   │   ├── activity.py           # Composite planetary activity index
│   │   ├── correlation.py        # Lag correlation & Benjamini-Yekutieli FDR
│   │   ├── lament_detector.py    # Multi-domain compound cascade detector
│   │   ├── narrative.py          # "Tethys Speaks" natural language generator
│   │   ├── pattern_memory.py     # State vector hashing & pattern catalog
│   │   ├── prewhiten.py          # Box-Jenkins ARIMA prewhitening
│   │   ├── scheduler.py          # Periodic background analysis dispatcher
│   │   ├── transfer_entropy.py   # Schreiber Transfer Entropy (pyinform)
│   │   ├── wavelet.py            # Continuous Wavelet Coherence (pycwt)
│   │   └── zscore.py             # Robust MAD Z-score anomaly calculator
│   ├── api/                      # REST & WebSocket transport layer
│   │   ├── routes/
│   │   │   ├── analysis.py       # Anomaly, correlation & narrative endpoints
│   │   │   ├── events.py         # Domain telemetry querying endpoints
│   │   │   └── websocket.py      # Real-time event broadcast & heartbeat
│   │   └── main.py               # FastAPI lifespan & application entrypoint
│   ├── collectors/               # 12 telemetry ingestion workers
│   │   ├── base.py               # BaseCollector abstract worker with status logging
│   │   ├── atmospheric.py        # Open-Meteo meteorological collector
│   │   ├── cosmic_ray.py         # GOES high-energy proton flux collector
│   │   ├── donki.py              # NASA CCMC space weather collector
│   │   ├── geomagnetic.py        # Kp, Dst, and AE index collector
│   │   ├── goes_flux.py          # GOES primary X-ray sensor collector
│   │   ├── gravity_field.py      # GRACE-FO mascon metadata collector
│   │   ├── ionospheric.py        # NOAA GLOTEC 2D TEC collector
│   │   ├── lightning.py          # Global strike detection collector
│   │   ├── ocean_indices.py      # Oceanic Niño Index (ONI) collector
│   │   ├── seismic.py            # USGS real-time seismic collector
│   │   ├── solar_wind.py         # NOAA SWPC DSCOVR plasma collector
│   │   ├── tsunami_warning.py    # NOAA NWS tsunami alert collector
│   │   └── volcanic.py           # Smithsonian GVP volcanic activity collector
│   ├── db/                       # Persistence schemas & connection pool
│   │   ├── connection.py         # Resilient asyncpg connection pool manager
│   │   ├── init.sql              # Initial TimescaleDB extension setup
│   │   ├── migrations/           # Versioned SQL migration scripts
│   │   └── schema.py             # Hypertables & continuous aggregate DDL
│   ├── config.py                 # Pydantic environment configuration
│   └── tests/                    # Pytest test suite with async fixtures
├── frontend/
│   ├── src/
│   │   ├── api/                  # Axios HTTP client & endpoint contracts
│   │   ├── components/           # Modular React components
│   │   │   ├── cards/            # Domain telemetry cards & anomaly feeds
│   │   │   ├── charts/           # Time-series Recharts components
│   │   │   ├── filters/          # Temporal range and domain filter bars
│   │   │   ├── globe/            # MapLibre GL JS v5 3D globe container
│   │   │   ├── layout/           # HUD header, tab navigation, and live feed
│   │   │   └── shared/           # Reusable glassmorphic UI primitives
│   │   ├── hooks/                # Custom React hooks (useWebSocket, etc.)
│   │   ├── stores/               # Zustand state stores (data, globe, tabs)
│   │   ├── types/                # TypeScript interface definitions
│   │   └── utils/                # Coordinate conversions, colors, shaders
│   ├── package.json              # Frontend dependencies and build scripts
│   └── vite.config.ts            # Vite 6 configuration & plugin setup
├── docker/                       # Container provisioning configurations
├── docs/                         # In-depth architectural & scientific specs
├── docker-compose.yml            # Local development orchestration
├── docker-compose.prod.yml       # Production deployment with resource tuning
├── Dockerfile                    # Multi-stage container definition
└── pyproject.toml                # Python dependencies, Ruff & Mypy configs
```

---

## Getting Started

### Prerequisites

- **Python**: 3.12 or newer
- **Node.js**: 22 LTS or newer (`npm` or `pnpm`)
- **Docker**: Docker Engine 24+ with Docker Compose v2

### Local Development Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Schnee111/tethys-system.git
   cd tethys-system
   ```

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   ```
   *The default `.env` is pre-configured for local development with zero external API key requirements.*

3. **Start TimescaleDB Service**
   ```bash
   docker compose up -d
   ```
   *Verifies TimescaleDB on `localhost:5432` with user `tethys` and database `tethys`.*

4. **Initialize Python Backend**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install --pre -e ".[dev]"
   
   # Run the FastAPI server with live reload
   uvicorn backend.api.main:app --reload --host 127.0.0.1 --port 8000
   ```

5. **Start Frontend Client**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Access the local observatory at `http://localhost:5173`.*

---

## Production Deployment & DevOps

TETHYS is engineered for high reliability under constrained server resources (optimized for low-memory environments $\le 4\text{ GB RAM}$).

### Container Deployment

```bash
# Build and run containers in production mode
docker compose -f docker-compose.prod.yml up -d --build

# Inspect container health and collector logs
docker compose -f docker-compose.prod.yml logs -f tethys-api
```

### Production Hardening Highlights

- **Lean Memory Footprint**: PostgreSQL shared buffers and worker memory are explicitly constrained in `docker-compose.prod.yml` (`shared_buffers=256MB`, `work_mem=4MB`), maintaining a system RSS footprint around ~350 MB.
- **Sentinel Filtering**: Collectors enforce strict missing-data guards (`f <= -999`) to prevent NOAA/SWPC sentinel values from poisoning continuous aggregates and inflating anomaly statistics.
- **Automated Disk & Cache Hygiene**: GitHub Actions deployment workflows automatically invoke `docker image prune` and time-bound BuildKit pruning (`builder prune --filter "until=24h"`) on each release to prevent storage exhaustion.
- **Nginx Ingress Architecture**: Production deploys isolate Uvicorn behind Nginx with explicit HTTP/1.1 WebSocket upgrade headers (`Upgrade $http_upgrade`, `Connection "upgrade"`) and strict proxy timeouts (`86400s`).

---

## Verification & Testing Suite

Execute the comprehensive test and quality assurance suite:

```bash
# Python code formatting and linting
ruff check backend
ruff format --check backend

# Static type verification
mypy backend

# Asynchronous backend unit & integration tests
pytest backend/tests -v --cov=backend

# Frontend typecheck & linting
cd frontend
npm run lint
npm test
```

---

## Primary API Endpoints

### REST API v1

- `GET /api/v1/health` — Service health and database connectivity probe.
- `GET /api/v1/status` — Comprehensive collector runtime status and ingestion record counts.
- `GET /api/v1/events/seismic` — Query seismic events with magnitude, depth, and time horizon filters.
- `GET /api/v1/events/solar_wind` — Query DSCOVR solar wind plasma and magnetic field vectors.
- `GET /api/v1/events/goes` — Query primary solar X-ray flux and proton counts.
- `GET /api/v1/events/ionospheric` — Fetch global 2D Total Electron Content (TEC) readings.
- `GET /api/v1/events/atmospheric` — Query meteorological readings across global stations.
- `GET /api/v1/anomalies` — Query detected MAD-based anomalies across all monitored domains.
- `GET /api/v1/activity` — Retrieve current composite planetary activity index score.
- `GET /api/v1/correlations` — Inspect cross-domain lag correlations with BY-FDR metrics.
- `GET /api/v1/narrative` — Generate on-the-fly natural language situational debrief.

### Real-Time WebSocket Interface

Connect to `wss://tethys.web.id/ws/v1/live` (or `ws://127.0.0.1:8000/ws/v1/live` in development):

```json
{
  "type": "seismic",
  "data": {
    "id": "us7000abcd",
    "magnitude": 6.2,
    "place": "120 km SSW of Banda Aceh, Indonesia",
    "time": "2026-09-17T06:12:00Z",
    "coordinates": [95.12, 4.35, 24.5],
    "tsunami": 0
  },
  "timestamp": "2026-09-17T06:12:05Z"
}
```

---

## Author & Attribution

**TETHYS** is architected, developed, and maintained by:

- **Muhammad Daffa Ma’arif** ([@Schnee111](https://github.com/Schnee111))  
  *Software Engineer & Applied AI Systems Researcher*

---

## Institutional Data Acknowledgments

We gratefully acknowledge the open data policies of the following scientific bodies and observation networks:

- **USGS Earthquake Hazards Program** — Global real-time seismic event telemetry.
- **NOAA Space Weather Prediction Center (SWPC)** — Solar wind, GOES X-ray flux, proton flux, GLOTEC ionospheric TEC, and geomagnetic indices.
- **NASA Community Coordinated Modeling Center (CCMC)** — Space Weather Database Of Notifications, Knowledge, Information (DONKI).
- **Smithsonian Institution Global Volcanism Program (GVP)** & **NASA EONET** — Global volcanic activity and natural hazard event feeds.
- **Open-Meteo Project** — High-resolution global meteorological station data feeds.
- **NOAA Climate Prediction Center (CPC)** & **National Weather Service (NWS)** — Oceanic Niño Index and tsunami warning bulletins.
- **MapLibre Community** — High-performance open-source 3D WebGL cartographic mapping engine.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
