# TETHYS — Planetary Intelligence System

## ⚠️ IMPORTANT DISCLAIMER

**Tethys is a research tool, NOT a prediction system.**

This system observes correlations in planetary data. It does NOT predict
earthquakes, solar storms, or any natural disasters.

- Correlation ≠ Causation
- Z-score anomalies indicate statistical outliers, not warnings
- The "Lament Detector" is a narrative framework, not a scientific claim
- Solar-seismic correlation research is ongoing and controversial
- USGS position: "It has never been demonstrated that there is a causal
  relationship between space weather and earthquakes"

If you use this system or its data, you are responsible for your own
interpretation. Do not use Tethys data to make safety decisions.

---

## What Is This?

Tethys is a real-time planetary monitoring system that watches multiple Earth and space systems simultaneously, searching for hidden correlations between seismic activity, space weather, atmospheric conditions, and oceanic data.

Inspired by the Tethys System from Wuthering Waves — a computational intelligence that monitors the planet for catastrophic anomalies (the "Lament"). **This is a creative/artistic framing, not a scientific claim.**

## Why Build This?

### The Problem
- No unified system monitors multiple planetary signals simultaneously
- Existing tools are domain-specific (USGS for earthquakes, NOAA for weather, SWPC for space weather)
- Cross-domain correlations (e.g., solar activity ↔ seismic activity) are understudied
- Existing dashboards are boring — flat charts, no immersive visualization

### The Opportunity
- All data sources are free and real-time
- Cross-domain correlation research exists but is fragmented (Nature: Scientific Reports, 2020)
- Modern web tech (Three.js, WebGL) enables immersive 3D visualization
- ML anomaly detection is mature and accessible
- A single developer with free tools can build something meaningful

### The Vision
A living intelligence that watches the planet — not as separate data streams, but as one interconnected system. When multiple domains spike simultaneously, Tethys detects it, visualizes it, and explains it.

---

## Data Sources (All Free, Real-Time)

### 1. Seismic — USGS Earthquake API

**Source:** USGS Earthquake Hazards Program
**Endpoint:** `https://earthquake.usgs.gov/earthquakes/feed/v1.0/`
**Format:** GeoJSON
**Update Frequency:** Every 1 minute
**Authentication:** None required
**Rate Limits:** Generous (designed for real-time apps)

**Available Feeds:**
- Past Hour: `summary/{significant|4.5|2.5|1.0|all}_hour.geojson`
- Past Day: `summary/{significant|4.5|2.5|1.0|all}_day.geojson`
- Past 7 Days: `summary/{significant|4.5|2.5|1.0|all}_week.geojson`
- Past 30 Days: `summary/{significant|4.5|2.5|1.0|all}_month.geojson`

**Data Fields:**
- `mag` — Magnitude (decimal)
- `place` — Location description
- `time` — Unix timestamp (ms)
- `coordinates` — [longitude, latitude, depth_km]
- `type` — "earthquake", "quarry", etc.
- `tsunami` — 1 if tsunami warning issued
- `sig` — Significance rating
- `alert` — PAGER alert level
- `felt` — Number of "Did You Feel It?" reports
- `cdi` — Community Determined Intensity
- `mmi` — Modified Mercalli Intensity

**Also Available:**
- FDSN Catalog API: `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=...&endtime=...`
- Supports historical data queries back to 1900+

---

### 2. Solar Wind — NOAA SWPC (DSCOVR Satellite)

**Source:** NOAA Space Weather Prediction Center
**Endpoint:** `https://services.swpc.noaa.gov/products/solar-wind/`
**Format:** JSON arrays (header + data rows)
**Update Frequency:** Every 1 minute (mag-5-minute, plasma-5-minute)
**Authentication:** None required

**Available Files:**
- `mag-5-minute.json` — Magnetic field (Bt, Bx, By, Bz) — 5-min cadence
- `mag-2-hour.json` — 2-hour magnetic field data
- `mag-1-day.json` — 1-day magnetic field data
- `plasma-5-minute.json` — Solar wind (density, speed, temperature) — 5-min cadence
- `plasma-2-hour.json` — 2-hour plasma data
- `plasma-1-day.json` — 1-day plasma data
- `ephemerides.json` — DSCOVR spacecraft position

**Data Fields (Magnetometer):**
- `time_tag` — ISO timestamp
- `bx_gsm`, `by_gsm`, `bz_gsm` — Magnetic field components (GSM coords, nT)
- `bt` — Total magnetic field (nT)
- `lon_gsm`, `lat_gsm` — Field direction

**Data Fields (Plasma):**
- `time_tag` — ISO timestamp
- `density` — Proton density (protons/cm³)
- `speed` — Solar wind speed (km/s)
- `temperature` — Proton temperature (K)

---

### 3. GOES Satellite — X-Ray, Proton, Electron Flux

**Source:** NOAA SWPC GOES Data
**Endpoint:** `https://services.swpc.noaa.gov/json/goes/primary/`
**Format:** JSON
**Update Frequency:** Every 1-5 minutes
**Authentication:** None required

**Available Data:**
- `xrays-1-day.json` — X-ray flux (1-8 Å and 0.5-4 Å bands)
- `integral-protons-1-day.json` — Proton flux (≥10 MeV, ≥50 MeV, ≥100 MeV)
- `integral-electrons-1-day.json` — Electron flux (≥2 MeV)
- `magnetometers-1-day.json` — GOES magnetometer data
- `xray-flares-latest.json` — Latest detected solar flares
- `suvi-flares-latest.json` — SUVI-detected flares
- `euvs-1-day.json` — Extreme UV sensor data

**Time Ranges:** 6-hour, 1-day, 3-day, 7-day

**Data Fields (X-ray):**
- `time_tag` — ISO timestamp
- `flux` — X-ray flux (W/m²)
- `observed_flux` — Observed flux
- `electron_contamination_flag`

---

### 4. NASA DONKI — Space Weather Events

**Source:** NASA CCMC (Community Coordinated Modeling Center)
**Endpoint:** `https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/`
**Format:** JSON
**Update Frequency:** Near real-time (event-driven)
**Authentication:** None required (optional API key for higher rate limits)

**Available Endpoints:**
- `/CME?startDate=yyyy-MM-dd&endDate=yyyy-MM-dd` — Coronal Mass Ejections
- `/CMEAnalysis?startDate=...&endDate=...` — CME analysis with speed, direction
- `/GST?startDate=...&endDate=...` — Geomagnetic Storms
- `/IPS?startDate=...&endDate=...` — Interplanetary Shocks
- `/FLR?startDate=...&endDate=...` — Solar Flares
- `/SEP?startDate=...&endDate=...` — Solar Energetic Particle Events
- `/HSS?startDate=...&endDate=...` — High Speed Streams
- `/MPC?startDate=...&endDate=...` — Magnetopause Crossings
- `/RBE?startDate=...&endDate=...` — Radiation Belt Enhancements
- `/notifications` — All space weather notifications

**Data Fields (CME):**
- `activityID` — Unique event ID
- `startTime` — CME start time
- `sourceLocation` — Solar source location
- `activeRegionNum` — Active region number
- `speed` — CME speed (km/s)
- `type` — CME type
- `cmeAnalyses` — Detailed analysis (speed, direction, half-angle)

---

### 5. Atmospheric — Open-Meteo API

**Source:** Open-Meteo (Open Source)
**Endpoint:** `https://api.open-meteo.com/v1/forecast?past_days=2&forecast_days=0`
**Format:** JSON
**Update Frequency:** Every 6 hours (polling), ~15-30 min data availability
**Authentication:** None required (free for non-commercial)
**Rate Limits:** 10,000 requests/day
**Data Type:** Observed (station + satellite reanalysis), NOT forecast predictions

NOTE: The "forecast" API name is misleading. With `forecast_days=0`,
it returns zero predictions — only past observations via `past_days=2`.
This is the same observation quality as the archive API but near-real-time
instead of 1-2 days delayed.

**Available Variables:**
- Temperature (2m, surface)
- Pressure (surface, sea level)
- Wind speed/direction (10m, 100m)
- Precipitation
- Cloud cover
- UV index
- Soil temperature/moisture

**Geocoding:** `https://geocoding-api.open-meteo.com/v1/search?name=...`

---

### 6. Volcanic — NASA EONET / USGS

**Source:** Smithsonian Global Volcanism Program
**Format:** RSS/Atom feeds, CSV
**Update Frequency:** Daily (event-driven)
**Authentication:** None

**Endpoints:**
- `https://volcano.si.edu/gvp_weekly.cfm` — Weekly reports
- USGS Volcano Hazards Program feeds

---

### 7. Additional Sources (Future Phases)

- **INTERMAGNET** — Global magnetometer network (1-min data)
- **NASA GRACE-FO** — Gravity field changes (monthly)
- **Copernicus Marine** — Ocean temperature, currents
- **NASA FIRMS** — Fire detection (satellite)
- **NOAA Tsunami Warning** — Real-time tsunami alerts

---

## Scientific Basis: Cross-Domain Correlations

### Solar Activity ↔ Seismic Activity

**Status:** Controversial but supported by evidence

**Key Research:**
- Nature Scientific Reports (2020): "On the correlation between solar activity and large earthquakes" — Establishes statistical correlation using long datasets
- ScienceDirect (2025): "A study of solar wind parameters and seismic activity" — Investigates 17 earthquake events influenced by geomagnetic activity
- USGS Position: "It has never been demonstrated that there is a causal relationship" — But correlation studies continue

**Mechanism Hypotheses:**
- Solar wind pressure on magnetosphere → electromagnetic induction in crust
- Geomagnetic storms → piezoelectric effects in quartz-bearing rocks
- Solar proton events → ionospheric conductivity changes → telluric currents

**What Tethys Can Do:**
- Track solar wind parameters (speed, density, Bz) continuously
- Monitor earthquake frequency and magnitude
- Compute rolling correlations with configurable time windows
- Flag periods where correlation exceeds statistical significance

### Other Cross-Domain Patterns
- Ocean temperature anomalies → atmospheric pressure changes → storm patterns
- Volcanic activity → atmospheric aerosol → temperature anomalies
- Geomagnetic storms → GPS/satellite anomalies → communication disruptions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TETHYS ARCHITECTURE                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 DATA COLLECTORS                       │   │
│  │  (Python asyncio, run on VPS)                         │   │
│  │                                                       │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│  │  │USGS     │ │NOAA     │ │GOES     │ │NASA     │   │   │
│  │  │Seismic  │ │Solar    │ │X-ray/   │ │DONKI    │   │   │
│  │  │(1 min)  │ │Wind     │ │Proton   │ │Events   │   │   │
│  │  │         │ │(5 min)  │ │(1 min)  │ │(15 min) │   │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘   │   │
│  │       └───────────┴───────────┴───────────┘          │   │
│  │                       │                               │   │
│  └───────────────────────┼───────────────────────────────┘   │
│                          ▼                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              TIME-SERIES DATABASE                     │   │
│  │              (TimescaleDB on VPS)                     │   │
│  │                                                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │   │
│  │  │seismic   │ │solar_wind│ │xray_flux │ ...         │   │
│  │  │events    │ │readings  │ │readings  │             │   │
│  │  └──────────┘ └──────────┘ └──────────┘             │   │
│  └───────────────────────┬───────────────────────────────┘   │
│                          │                                    │
│  ┌───────────────────────┼───────────────────────────────┐   │
│  │              ANALYSIS ENGINE                           │   │
│  │              (Python, on VPS)                          │   │
│  │                                                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │   │
│  │  │Anomaly   │ │Correlation│ │Prediction│             │   │
│  │  │Detection │ │Engine    │ │Models    │             │   │
│  │  │(Z-score, │ │(rolling  │ │(LSTM/    │             │   │
│  │  │ Isolation │ │ window)  │ │ ONNX)    │             │   │
│  │  │ Forest)  │ │          │ │          │             │   │
│  │  └──────────┘ └──────────┘ └──────────┘             │   │
│  └───────────────────────┬───────────────────────────────┘   │
│                          │                                    │
│  ┌───────────────────────┼───────────────────────────────┐   │
│  │              API + WEBSOCKET SERVER                    │   │
│  │              (FastAPI on VPS)                          │   │
│  │                                                       │   │
│  │  REST: /api/events, /api/anomalies, /api/status       │   │
│  │  WS:   /ws/live — real-time event stream              │   │
│  └───────────────────────┬───────────────────────────────┘   │
│                          │                                    │
│  ┌───────────────────────┼───────────────────────────────┐   │
│  │              3D GLOBE DASHBOARD                        │   │
│  │              (Three.js + globe.gl)                     │   │
│  │              Hosted on Cloudflare Pages (free)         │   │
│  │                                                       │   │
│  │  • Interactive 3D Earth                                │   │
│  │  • Real-time event visualization                       │   │
│  │  • Correlation arcs                                    │   │
│  │  • Anomaly feed                                        │   │
│  │  • Tethys speaks (AI narrative)                        │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Backend (VPS — 4GB RAM, 60GB Storage)

| Component | Technology | Why |
|-----------|-----------|-----|
| Language | Python 3.12 | Best ecosystem for data + ML |
| Async Framework | asyncio + aiohttp | Non-blocking API polling |
| API Server | FastAPI | Fast, async, WebSocket support |
| Database | TimescaleDB (PostgreSQL extension) | Time-series optimized, SQL compatible |
| ML Training | Google Colab (free T4 GPU) | No local GPU needed |
| ML Inference | ONNX Runtime | Lightweight, fast on CPU |
| Process Manager | systemd | Simple, reliable |

### Frontend (Cloudflare Pages — Free)

| Component | Technology | Why |
|-----------|-----------|-----|
| Framework | React 18 + TypeScript | Mature, ecosystem |
| 3D Globe | globe.gl (Three.js wrapper) | Best for data visualization globes |
| State | Zustand | Lightweight, fast |
| Styling | Tailwind CSS | Dark theme, utility-first |
| WebSocket | Native WebSocket API | Real-time updates |
| Build | Vite | Fast, modern |
| Hosting | Cloudflare Pages | Free, global CDN |

### ML/Analysis

| Component | Technology | Why |
|-----------|-----------|-----|
| Anomaly Detection | Isolation Forest (sklearn) | Works on multivariate data |
| Time-Series | Z-score + rolling statistics | Simple, interpretable |
| Correlation | Pearson/Spearman (scipy) | Standard statistical methods |
| Prediction | LSTM (PyTorch → ONNX) | Sequence prediction |
| Training | Google Colab | Free GPU |

---

## Resource Constraints & Solutions

```
CONSTRAINT              SOLUTION
──────────────────────  ──────────────────────────────────
VPS: 4GB RAM            • TimescaleDB: ~512MB RAM
                        • FastAPI: ~100MB RAM
                        • Collectors: ~200MB RAM
                        • Total: ~1GB, leaves headroom

VPS: 60GB storage       • Raw data: ~50MB/day
                        • 3 years of data before cleanup
                        • Compress old data, archive to free object storage

No GPU for training     • Google Colab: free T4 GPU
                        • Export trained model as ONNX
                        • ONNX Runtime inference on VPS CPU

No team                 • Solo developer (you)
                        • AI assistant (me)
                        • Open-source libraries
                        • Start simple, iterate

Budget: $0              • All APIs: free
                        • All tools: open-source
                        • VPS: already owned
                        • Cloudflare Pages: free
                        • Google Colab: free
```

---

## Project Phases

### Phase 1: Foundation (Week 1-3)
**Goal:** Collect real-time data from all sources

- Set up project structure (monorepo: backend + frontend)
- Build data collectors for all 6 domains
- Set up TimescaleDB on VPS with continuous aggregates
- Create unified data schema
- Basic REST API to query stored data
- WebSocket live event stream with ping/pong
- Verify data is flowing and stored correctly

**Deliverable:** Data collectors running 24/7, database filling with real-time data

### Phase 2: Intelligence (Week 4-6)
**Goal:** Detect anomalies and correlations

- Implement anomaly detection (Z-score, Isolation Forest)
- Build rolling correlation engine with FDR correction
- Create alert thresholds
- Export analysis results via API
- Google Colab notebook for Isolation Forest training
- Threat assessment scoring

**Deliverable:** System can detect anomalies and flag cross-domain correlations

### Phase 3: Visualization (Week 7-12)
**Goal:** Build the 3D interactive globe

- Set up React + Vite project
- Integrate globe.gl for 3D Earth
- WebGL detection + 2D Leaflet fallback
- Implement real-time data overlay (earthquakes as pulses, solar wind as particles)
- Add time scrubber (rewind/fast-forward) with live/buffered state
- Implement event detail panels
- Add correlation arc visualization
- Three.js memory management (object pool + dispose)
- Responsive design (mobile + desktop)
- Deploy to Cloudflare Pages

**Deliverable:** Working 3D dashboard with real-time data

### Phase 4: Intelligence Layer (Week 13-15)
**Goal:** Tethys speaks

- Natural anomaly summaries
- Threat level composite scoring
- "Tethys Observes" feed with AI-generated insights
- Historical pattern playback
- Sound design (ambient, alert tones)
- Scientific disclaimer in UI

**Deliverable:** Tethys feels alive — not just data, but intelligence

### Phase 5: Polish & Scale (Week 16-18)
**Goal:** Production quality

- Nginx reverse proxy + SSL
- Data retention + compression policies
- Performance optimization
- Mobile responsive testing
- Error handling and recovery
- Documentation
- Open-source release preparation

**Deliverable:** Production-ready system

**NOTE:** Original timeline was 12 weeks. Adjusted to 24 weeks (6 months) based on
solo developer capacity and 6 rounds of external engineering review.
Phase 3 alone (React + globe.gl + 6 layers + WebSocket + responsive
+ Three.js memory + WebGL fallback) requires 8-10 weeks minimum.
Total: Phase 1 (3w) + Phase 2 (3w) + Phase 3 (10w) + Phase 4 (4w) + Phase 5 (4w) = 24 weeks.

---

## What Makes This Different

| Existing Tools | Tethys |
|---------------|--------|
| Single-domain monitoring | Multi-domain unified intelligence |
| Flat 2D charts | Interactive 3D globe |
| Manual correlation | Automated cross-domain correlation |
| Static dashboards | Living, speaking intelligence |
| Separate tools for each signal | One system watching everything |
| No anomaly detection | Real-time anomaly + correlation detection |
| Boring | Alive |

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| API rate limits | Low | All APIs are generous for real-time apps |
| VPS memory pressure | Medium | Monitor, optimize, use connection pooling |
| Data source downtime | Medium | Multiple sources per domain, graceful degradation |
| Scope creep | High | Strict phase gates, MVP first |
| Solar-seismic correlation is noise | Medium | Present as research, not prediction |
| Solo developer burnout | Medium | Small phases, visible progress |

---

## Success Criteria

1. **Data:** System collects and stores real-time data from 5+ sources 24/7
2. **Intelligence:** Anomalies detected within minutes, cross-domain correlations flagged
3. **Visualization:** Interactive 3D globe with real-time overlays
4. **Experience:** Dashboard feels alive, not like a spreadsheet
5. **Discovery:** At least one interesting cross-domain pattern identified
6. **Open:** Code is clean enough to open-source

---

## Documentation Index

```
DOCUMENT              PURPOSE
────────────────────  ──────────────────────────────────────────
PROJECT.md            This file — full project overview
PHASE1-SPEC.md        Data foundation — collectors, DB, API
PHASE2-SPEC.md        Intelligence — anomaly detection, correlation
PHASE3-SPEC.md        Visualization — 3D globe, dashboard
PHASE4-SPEC.md        Intelligence layer — Tethys speaks, Lament
PHASE5-SPEC.md        Polish — security, retention, open-source
INFRASTRUCTURE.md     Deployment — VPS setup, Nginx, SSL, backups
```

## Decision Log

| Decision | Rationale | Source |
|----------|-----------|--------|
| solar_wind: ON CONFLICT DO UPDATE | Plasma & mag arrive from separate NOAA files; DO NOTHING discards second file | Gemini Review |
| BaseCollector: dynamic insert_query | Different tables need different SQL; inheritance via subclass | Gemini Review |
| Bulk insert: executemany() | Single-row INSERT is slow for 7-day bulk data | Gemini Review |
| Open-Meteo: multi-coordinate request | 1 HTTP request instead of 20; 20x less network overhead | Gemini Review |
| goes_flux: satellite in PK | Prevents collision between primary/secondary GOES data | Gemini Review |
| atmospheric_data: lat/lon as PK | Grid-based (259K points), not city-based; lat/lon composite key | Gemini Review |
| Nginx/SSL: Phase 5, not Phase 1 | Phase 1 is development; security hardening comes with production | Critical Analysis |
| Time bucket: no Phase 1 prep needed | time_bucket() works on any hypertable; query-time function | Critical Analysis |
| Compression: Phase 5 | Data foundation first; storage management after data is flowing | Critical Analysis |
| SciPy: NaN/Inf filtering before correlation | pearsonr throws ValueError on NaN, Inf, constant arrays | Gemini + SciPy Docs |
| Anomaly ID: deterministic hash | md5(time:domain:metric) prevents duplicates on re-runs | Gemini Review |
| Three.js: dispose() on every removal | WebGL resources leak without explicit disposal; crashes browser in ~2h | Three.js Docs |
| WebSocket: application-level ping/pong | Browser WS API can't send protocol pings; proxies kill idle connections in 60s | websockets.readthedocs.io + websocket.org |
| Pattern hashing: bin floats first | Raw floats (28.51 vs 28.52) produce different hashes; Tethys never recognizes recurrence | Gemini Review |
| Cascade: require global trigger | Local-only coincidences (rain + earthquake) are noise, not Lament patterns | Gemini Review |
| Retention: 6 months + 7 days buffer | Prevents race condition where retention drops data before aggregation runs | TimescaleDB Docs |
| React 18 StrictMode: useRef guard | Dev-only double-mount; useRef flag prevents duplicate WebSocket connections | React Docs |
| WebSocket: delta filter on broadcast | Server restart fetches 7-day data; broadcasting all floods WebSocket + crashes browser | Gemini Review |
| ML: inference only on VPS | IsolationForest n_jobs=-1 locks 2 vCPUs; train on Colab, infer on VPS | Gemini Review |
| Continuous aggregates: Phase 1 | CorrelationEngine needs hourly aggregates for 30-day queries; raw scan = CPU starvation | TimescaleDB Docs |
| CORS: specific origins only | allow_origins=["*"] + allow_credentials=True violates CORS spec; browsers reject | FastAPI Docs |
| timescaledb-tune: required | Default shared_buffers (128MB) causes disk thrashing on 4GB VPS | timescaledb-tune GitHub |
| Volcanic: NASA EONET API | NASA EONET is HTML scraping; EONET is structured JSON, free, stable | NASA EONET Docs |
| Isolation Forest: min 5000 samples | Sparse data produces garbage models; delay until 60+ days | Claude Review |
| WebGL: detection + Leaflet fallback | Low-end Android fails WebGL; blank page without fallback | Claude Review |
| Scientific disclaimer: required | Lament Detector language could mislead public; add clear disclaimers | Claude Review |
| FDR correction: Benjamini-Hochberg | 21 tests × p<0.05 = ~1 false positive/hour; FDR corrects for multiple testing | statsmodels Docs |
| Threat weights: initial/calibratable | Arbitrary weights need empirical calibration over 90 days | Claude Review |
| Timeline: 12 → 18 weeks | Phase 3 alone needs 6 weeks for solo developer | Claude Review |
| API versioning: /api/v1/ prefix | Prevents breaking changes when frontend is deployed | Claude Review |
| Password: fail loudly | No insecure defaults; raise ValueError if DATABASE_URL not set | Claude Review |
| Restore test: monthly checklist | Backup without restore test is illusion of safety | Claude Review |
| Time scrubber: buffer WebSocket | Scrubbing to past + live events = confusing; buffer when not LIVE | Claude Review |
| Object Pool: hide, don't dispose | dispose() destroys GPU memory; pool reuse requires visible=false | Gemini Review |
| Buffer: ring cap at 5000 | Unbounded buffer = browser OOM; discard oldest when full | Gemini Review |
| Connection pool: max_size=15 | Unbounded asyncpg connections = PostgreSQL OOM on 4GB VPS | Gemini Review |
| Systemd: StartLimitBurst=5 | Restart=always without limit = infinite restart loop + log spam | Gemini Review |
| FDR test: Python pytest | FDR runs on backend; Jest test was wrong language | Claude Review |
| Disclaimer: sessionStorage | Safety info should show per session, not once forever | Claude Review |
| Fallback test: data-testid | Fragile text assertion replaced with data-testid | Claude Review |
| Pattern: two-table architecture | PK (time, pattern_id) means ON CONFLICT never triggers; split catalog + events | Gemini Review |
| Globe: useRef + requestAnimationFrame | Zustand state change every 1s = React re-render = 10fps; use imperative updates | Gemini Review |
| Page Visibility API | Tab hidden = browser throttles JS, buffer grows, state desyncs; pause on hide | Gemini Review |
| Anomaly: MAD not Z-score | Heavy-tail distributions (earthquakes, flares) violate normality; MAD is robust | GPT Review |
| Uncertainty propagation | Threat score without confidence is misleading when sources are down | GPT Review |
| Time watermark system | Different source latencies cause correlation bias; watermark filters stale data | GPT Review |
| Research roadmap: 4 phases | Advanced correlation → Bayesian → Temporal graph → LLM + paper | GPT Review |
| Lag correlation: test 0/24/48/72h | CME→seismic effects take hours/days; T0 correlation misses signal | Gemini Review |
| Pearson guardrail: continuous only | Discrete data (CME, volcanic) → garbage correlation; whitelist metrics | Gemini Review |
| WebSocket: handle sync_request | Frontend sends sync_request but backend never handled it; silent fail | Gemini Review |
| Watermark window: start from watermark | WHERE time > NOW() - window gives wrong window; start from watermark | Gemini Review |
| Timeline: 18 → 24 weeks | Phase 3 alone needs 8-10 weeks; GPT says 6-9 months realistic | GPT Engineering |
| Atmospheric: 20 cities MVP | Density > breadth; expand to 100 after Phase 3 | GPT Engineering |
| Event sourcing: raw_ingestion | Immutable raw API responses; re-process if schema changes | GPT Engineering |
| Observability: lightweight only | Prometheus too heavy for 4GB VPS; use collector_status + logging | GPT Engineering |
| Granger causality in Phase 2 | Lag correlation is not causality; Granger test is F-test on lagged residuals | GPT Scientific |
| Earthquake: energy not count | events_per_hour contaminated by detection threshold; use Σ10^(1.5M+4.8) | GPT Scientific |
| Threat → Activity Index | "Threat" implies prediction; "Activity" implies observation | GPT Scientific |
| Event Replay System | Replay Carrington/Tonga/Turkey/Tohoku on globe; higher research value than AI narrative | GPT Scientific |
| Atmospheric: 259K grid points | 0.5° global + 0.25° polar + 0.25° tectonic = genuinely planetary | Schnee Decision |
| Atmospheric: 150 strategic points | Balance over brute-force; 80 cities + 30 ocean + 10 polar + 20 tectonic + 10 extreme | Schnee Decision |
| Open-Meteo: forecast not archive | forecast?past_days=2&forecast_days=0 returns OBSERVED data with ~15-30 min delay; archive API has 1-2 day delay | Gemini Review + API Testing |
| Stationarity: first-order diff | Atmospheric diurnal cycle causes spurious correlations; use ΔT | Gemini Review |
| Collectors: separate service | --workers 2 forks lifespan, doubling API calls + deadlock | Gemini Review |
| Correlation: use aggregate tables | Raw tables = millions of rows; aggregates = 1000x fewer | Gemini Review |
| Pattern: avg_recurrence_interval | "duration" was misleading; it's time between occurrences | Gemini Review |
| Globe: .pointsData() on change only | Calling .pointsData() in rAF = rebuild geometry 60fps = freeze | Gemini Review |
| raw_ingestion: RETURNING id | Race condition: subquery MAX(time) can target wrong row | Claude Review |
| Seismic: energy not count | SUM(10^(1.5M+4.8)) captures physical significance | Claude Review |
| Activity score: normalized | Domain weights * 0.75 + corr 0.25 = max 1.0 | Claude Review |
| Collector: exponential backoff | Repeated failures → increasing sleep, max 5 min | Claude Review |
| WebSocket: broadcast rate limit | Max 1 broadcast per type per 2s, prevents burst overload | Claude Review |
| Pattern: avg_recurrence_interval | 6 remaining references fixed in PHASE4 | Claude Review |
| ZScoreDetector: allowlist validation | Prevents SQL injection if values ever from external input | Claude Review |
| joblib.load: SHA256 checksum | Validates model integrity before deserialization | Claude Review |
| Atmospheric correlation: global AVG | 150 locations aggregated to global mean per bucket | Claude Review |

## Research Roadmap (Post-MVP)

After the core system is built and running, Tethys has a research trajectory
that could lead to a published paper and a genuine Earth-system intelligence
platform.

```
PHASE 6: Advanced Correlation (Month 5-6)
──────────────────────────────────────────
• Cross-correlation with lag detection
• Dynamic Time Warping (DTW) for pattern matching
• Granger Causality testing
• Transfer Entropy for information flow
• Candidate generation + mutual information filter

PHASE 7: Bayesian Threat Engine (Month 7-8)
───────────────────────────────────────────
• Bayesian update: prior → evidence → posterior
• Explainable threat scores with breakdown
• Confidence propagation from data source status
• Calibration against historical events

PHASE 8: Temporal Graph Learning (Month 9-12)
─────────────────────────────────────────────
• Pattern memory as directed temporal graph
• Event sequence hashing (not just binned values)
• Graph neural network for pattern recognition
• Causal discovery algorithms

PHASE 9: LLM Narrative + Research Publication
─────────────────────────────────────────────
• LLM + retrieval + structured facts + grounding
• Research paper: "Tethys: Cross-Domain Planetary Anomaly Detection"
• Open-source release with documentation
• Community contribution framework
```

This roadmap positions Tethys as:
- MVP: A beautiful, functional planetary dashboard
- Growth: A research-grade anomaly detection platform
- Maturity: A published, citable Earth-system intelligence system

---

## Next Steps

1. Review all spec documents
2. Confirm no further changes needed
3. Begin Phase 1 implementation
