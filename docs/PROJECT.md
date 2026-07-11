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

### 7. Geomagnetic Indices — NOAA SWPC

**Source:** NOAA Space Weather Prediction Center
**Endpoint:** `https://services.swpc.noaa.gov/json/planetary_k_index_1m.json`
**Format:** JSON
**Update Frequency:** Every 1 minute
**Authentication:** None required
**Priority:** 🔴 **CRITICAL** — Missing link between solar wind and seismic activity

**Available Endpoints:**
- `planetary_k_index_1m.json` — 1-minute Kp index
- `planetary_a_index.json` — Daily Ap index
- `dst.json` — Dst index (equatorial electrojet)
- `ae_index.json` — Auroral Electrojet index

**Data Fields (Kp Index):**
- `time_tag` — ISO timestamp
- `kp_index` — Planetary K-index (0-9 scale, logarithmic)
- `ap_index` — Planetary A-index (linear scale, nT)

**Data Fields (Dst Index):**
- `time_tag` — ISO timestamp
- `dst` — Disturbance Storm Time index (nT)
- Negative values indicate geomagnetic storms (< -50 nT = storm, < -100 nT = intense)

**Relevance:**
- Direct measure of geomagnetic response to solar wind
- Critical for validating solar-seismic correlation hypothesis
- Pattern detection: "Kp > 7 → 24-48h later seismic activity increase"
- Table `geomagnetic_indices` already exists in schema

---

### 8. Ionospheric TEC — NASA JPL / IGS

**Source:** NASA Jet Propulsion Laboratory / International GNSS Service
**Endpoint:** `https://cddis.nasa.gov/archive/gnss/products/ionex/`
**Format:** IONEX (Ionosphere Map Exchange format)
**Update Frequency:** Every 2 hours (final maps), 15 min (rapid)
**Authentication:** NASA Earthdata login (free registration)
**Priority:** 🟡 **HIGH** — Ionospheric disturbances correlate with seismic activity

**Available Data:**
- Global Ionosphere Maps (GIM) — TEC values worldwide
- TEC in TECU (1 TECU = 10^16 electrons/m²)
- Slant TEC along satellite paths

**Data Fields:**
- `time` — UTC timestamp
- `latitude`, `longitude` — Grid point (2.5° × 5° resolution)
- `tec` — Total Electron Content (TECU)
- `rms` — Root mean square error

**Relevance:**
- Ionospheric anomalies precede major earthquakes (research shows 24-48h before)
- TEC depletion/enhancement indicates ionospheric disturbances
- Can detect traveling ionospheric disturbances (TIDs) from seismic events
- Complements geomagnetic data for complete space weather picture

**Implementation Notes:**
- Large data files (~50MB per day)
- Requires parsing IONEX format (text-based grid data)
- Consider using rapid products for near-real-time (15-min delay)
- Alternative: Use Madrigal database API for easier access

---

### 9. Cosmic Ray — Neutron Monitor Database (NMDB)

**Source:** Neutron Monitor Database (NMDB) / Oulu Cosmic Ray Station
**Endpoint:** `http://nmdb.eu/nestjson.php`
**Format:** JSON
**Update Frequency:** Every 1 minute
**Authentication:** None required
**Priority:** 🟡 **HIGH** — Cosmic ray increases may precede earthquakes

**Available Endpoints:**
- `/nestjson.php?station=Oulu&datatype=corr&format=sec` — Oulu station, corrected data, second resolution
- `/nestjson.php?stationlist=all&datatype=raw&format=hour` — All stations, hourly data

**Data Fields:**
- `datetime` — ISO timestamp
- `count_rate` — Neutron count rate (counts/min)
- `pressure_corrected` — Pressure-corrected count rate
- `error` — Statistical error

**Relevance:**
- Cosmic ray intensity increases before earthquakes (Forbush decreases after)
- Mechanism: tectonic stress → radon emission → ionization → aerosol formation → cloud microphysics → atmospheric electric field → cosmic ray modulation
- Global network of neutron monitors (50+ stations)
- Can detect ground-level enhancements (GLE) from solar events

**Implementation Notes:**
- Data available from 1950s onwards (excellent for historical analysis)
- Multiple stations worldwide for redundancy
- Requires atmospheric pressure correction
- Consider using Oulu station as primary (longest continuous record)

---

### 10. Lightning — World Wide Lightning Location Network (WWLLN)

**Source:** University of Washington / WWLLN
**Endpoint:** `https://data.wwlln.net/api/v1/strikes`
**Format:** CSV / JSON (via API request)
**Update Frequency:** Near real-time (1-5 min delay)
**Authentication:** API key required (free for research)
**Priority:** 🟢 **MEDIUM** — Lightning activity correlates with atmospheric and seismic events

**Available Data:**
- Global lightning stroke locations
- Stroke time (microsecond precision)
- Stroke energy (relative)
- Lightning density maps

**Data Fields:**
- `time` — UTC timestamp (μs)
- `latitude`, `longitude` — Stroke location
- `energy` — Relative stroke energy
- `station_count` — Number of detecting stations

**Relevance:**
- Lightning rate increases before earthquakes (electrification of rocks)
- Correlates with atmospheric convection and severe weather
- Can detect volcanic lightning (distinguishes eruption type)
- Global coverage (oceans and land)

**Implementation Notes:**
- High data volume (~1000 strokes/sec globally)
- Requires spatial/temporal binning for analysis
- API access requires registration
- Alternative: Use GLD360 (Vaisala) for commercial-grade data

**Current Status:** ⚠️ **NEEDS ALTERNATIVE**
- WWLLN endpoint tidak accessible (DNS resolution failed)
- Tidak ada free lightning data API yang available tanpa authentication
- Collector running tapi tidak collecting data
- **TODO:** Cari alternatif seperti:
  - NOAA severe weather alerts (sebagai proxy untuk lightning activity)
  - OpenWeatherMap Lightning API (paid)
  - Blitzortung (community network, perlu check API availability)
  - Implementasi nanti setelah data sources lain selesai

---

### 11. Ocean Indices — NOAA / Copernicus Marine

**Source:** NOAA Climate Prediction Center / Copernicus Marine Service
**Endpoints:**
- ENSO: `https://origin.cpc.ncep.noaa.gov/products/analysis_monitoring/ens_advisory/ens_sst.shtml`
- NAO: `https://origin.cpc.ncep.noaa.gov/products/precip/CWlink/pna/norm.nao.shtml`
- Copernicus: `https://resources.marine.copernicus.eu/API/?service_id=GLOBAL_ANALYSIS_FORECAST_PHY_001_024`
**Format:** CSV / NetCDF
**Update Frequency:** Weekly (ENSO/NAO), Daily (Copernicus)
**Authentication:** Copernicus requires free registration
**Priority:** 🟢 **MEDIUM** — Long-term climate patterns affect all domains

**Available Indices:**
- **ENSO (El Niño/La Niña):** Ocean Niño Index (ONI), Niño 3.4 SST anomaly
- **NAO (North Atlantic Oscillation):** Pressure difference between Azores High and Icelandic Low
- **PDO (Pacific Decadal Oscillation):** Long-term Pacific SST pattern
- **AMO (Atlantic Multidecadal Oscillation):** North Atlantic SST variability

**Data Fields (ENSO):**
- `season` — 3-month season (DJF, JJA, etc.)
- `oni` — Ocean Niño Index (°C anomaly)
- `classification` — El Niño / La Niña / Neutral

**Data Fields (Copernicus):**
- `time` — UTC timestamp
- `latitude`, `longitude` — Grid point (0.083° resolution)
- `temperature` — Sea surface temperature (°C)
- `salinity` — Practical salinity (PSU)
- `current_u`, `current_v` — Ocean current components (m/s)
- `ssh` — Sea surface height (m)

**Relevance:**
- ENSO affects global atmospheric circulation → space weather propagation
- Ocean temperature anomalies → atmospheric pressure changes → storm patterns
- Long-term climate cycles modulate baseline conditions
- Copernicus data enables ocean-atmosphere coupling analysis

**Implementation Notes:**
- ENSO/NAO indices are simple CSV downloads (easy to implement)
- Copernicus data is large (global gridded, 3D)
- Consider using regional subsets (Pacific for ENSO, Atlantic for NAO)
- Monthly averages sufficient for most analyses

---

### 12. Gravity Field — NASA GRACE-FO

**Source:** NASA / German Research Centre for Geosciences (GFZ)
**Endpoint:** `https://podaac.jpl.nasa.gov/dataset/TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4`
**Format:** NetCDF
**Update Frequency:** Monthly (with ~2 month latency)
**Authentication:** NASA Earthdata login (free)
**Priority:** 🟢 **LOW** — Monthly data, not real-time

**Available Data:**
- Earth's gravity field anomalies (mascons)
- Equivalent water thickness (cm)
- Groundwater storage changes

**Data Fields:**
- `time` — Month (YYYY-MM)
- `latitude`, `longitude` — Grid point (1° resolution)
- `lwe_thickness` — Liquid water equivalent thickness (cm)
- `uncertainty` — Measurement uncertainty

**Relevance:**
- Mass redistribution indicates tectonic stress accumulation
- Groundwater changes affect crustal loading
- Correlates with large earthquake preparation zones
- Complements GPS/InSAR deformation data

**Implementation Notes:**
- Monthly data only (not suitable for real-time monitoring)
- Large spatial resolution (1° × 1°)
- 2-month latency limits usefulness for pattern detection
- Consider using for background context only

---

### 13. Fire Detection — NASA FIRMS

**Source:** NASA Fire Information for Resource Management System (FIRMS)
**Endpoint:** `https://firms.modaps.eosdis.nasa.gov/api/area/csv/OPEN_DATA_TOKEN`
**Format:** CSV
**Update Frequency:** Every 3-4 hours (near real-time)
**Authentication:** NASA FIRMS API key (free registration)
**Priority:** 🟢 **MEDIUM** — Fires affect atmospheric composition and temperature

**Available Data:**
- Active fire detections (MODIS, VIIRS satellites)
- Fire radiative power (FRP)
- Fire location and confidence

**Data Fields:**
- `latitude`, `longitude` — Fire location
- `brightness` — Brightness temperature (K)
- `frp` — Fire radiative power (MW)
- `confidence` — Detection confidence (low/nominal/high)
- `satellite` — MODIS/Terra, MODIS/Aqua, VIIRS

**Relevance:**
- Volcanic fires distinguish eruption type
- Large fires affect atmospheric aerosol → temperature anomalies
- Fire smoke affects atmospheric pressure and wind patterns
- Correlates with drought conditions (atmospheric domain)

**Implementation Notes:**
- High data volume (~10,000 fires/day globally)
- Requires spatial filtering (focus on regions of interest)
- API key required (free for research, 1000 requests/day)
- Consider using 24-hour aggregates for analysis

---

### 14. Tsunami Warning — NOAA

**Source:** NOAA National Tsunami Warning Center
**Endpoint:** `https://www.tsunami.gov/events/xml/PAAQEvent.xml`
**Format:** XML / CAP (Common Alerting Protocol)
**Update Frequency:** Event-driven (real-time)
**Authentication:** None required
**Priority:** 🟡 **HIGH** — Critical for safety (though Tethys is not a warning system)

**Available Data:**
- Tsunami warnings, watches, advisories
- Earthquake parameters that triggered alert
- Estimated arrival times
- Recommended actions

**Data Fields:**
- `event_id` — Unique event identifier
- `alert_level` — Warning / Watch / Advisory / Information
- `magnitude` — Earthquake magnitude
- `location` — Epicenter description
- `time` — Event time (UTC)
- `coordinates` — [latitude, longitude, depth]
- `arrival_times` — Estimated tsunami arrival times by location

**Relevance:**
- Validates seismic event significance
- Provides context for large earthquakes (M7+)
- Cross-reference with USGS seismic data
- Historical archive of tsunami events

**Implementation Notes:**
- Event-driven (only data when events occur)
- XML parsing required (CAP format)
- Low data volume (few events per year)
- Consider archiving all events for historical analysis

---

### 15. Tide Gauge — NOAA / IOC Sea Level Monitoring

**Source:** NOAA Tides & Currents / IOC Sea Level Monitoring Facility
**Endpoints:**
- NOAA: `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter`
- IOC: `https://www.ioc-sealevelmonitoring.org/service.php`
**Format:** JSON / CSV
**Update Frequency:** Every 6 minutes (NOAA), hourly (IOC)
**Authentication:** None required
**Priority:** 🟢 **LOW** — Sea level changes are slow

**Available Data:**
- Water level (relative to datum)
- Meteorological observations (pressure, wind)
- Quality flags

**Data Fields (NOAA):**
- `t` — Time (UTC)
- `v` — Water level value (meters/feet)
- `q` — Quality flag (v = verified, p = preliminary)
- `s` — Sigma (standard deviation)

**Relevance:**
- Sea level anomalies from tsunamis (validation)
- Storm surge from atmospheric pressure changes
- Long-term sea level rise (climate context)
- Co-seismic sea level changes (large earthquakes)

**Implementation Notes:**
- Thousands of stations worldwide
- Requires station selection (focus on key locations)
- NOAA API limited to US stations
- IOC provides global coverage but slower updates
- Consider using 100 key stations for global monitoring

---

### 16. Radon Gas — ISMN (International Soil Moisture Network) / Research Networks

**Source:** Various research networks (no single global source)
**Endpoint:** Research-specific (e.g., Japanese network, European networks)
**Format:** CSV / JSON
**Update Frequency:** Hourly (research networks)
**Authentication:** Varies by network
**Priority:** 🔴 **CRITICAL** — Radon increases precede earthquakes

**Available Data:**
- Soil radon concentration (Bq/m³)
- Soil temperature and moisture
- Atmospheric pressure

**Data Fields:**
- `time` — UTC timestamp
- `radon_concentration` — Radon activity (Bq/m³)
- `depth` — Measurement depth (cm)
- `temperature` — Soil temperature (°C)
- `moisture` — Soil moisture (%)

**Relevance:**
- Radon emission increases before earthquakes (rock stress → microfractures → radon release)
- Mechanism: tectonic stress → radon emission → ionization → atmospheric electric field → cosmic ray modulation
- Leading indicator for earthquake preparation phase
- Correlates with geomagnetic anomalies

**Implementation Notes:**
- No single global source (requires multiple research network integrations)
- Japanese network most active (Tohoku University)
- European networks (Italy, Greece) also active
- Data availability varies (some networks restrict access)
- Consider starting with Japanese network (most open data)
- Alternative: Use proxy indicators (soil temperature, groundwater level)

---

### 17. Satellite Telemetry — Space-Track.org

**Source:** US Strategic Command / Space-Track.org
**Endpoint:** `https://www.space-track.org/basicspacedata/query`
**Format:** JSON / XML / CSV
**Update Frequency:** Every few hours (TLE updates)
**Authentication:** Space-Track account (free registration)
**Priority:** 🟢 **LOW** — Satellite anomalies are rare

**Available Data:**
- Two-Line Element sets (TLE) for all tracked objects
- Orbital parameters
- Decay predictions

**Data Fields:**
- `NORAD_CATNR` — NORAD catalog number
- `EPOCH` — Orbital epoch (UTC)
- `MEAN_MOTION` — Revolutions per day
- `ECCENTRICITY` — Orbital eccentricity
- `INCLINATION` — Orbital inclination (degrees)
- `RA_OF_ASC_NODE` — Right ascension of ascending node (degrees)

**Relevance:**
- Satellite anomalies may indicate atmospheric density changes
- Orbital decay affected by thermospheric expansion (geomagnetic storms)
- Cross-reference with space weather events
- Detect unusual orbital perturbations

**Implementation Notes:**
- 20,000+ tracked objects (requires filtering)
- Focus on key satellites (ISS, weather satellites, GPS constellation)
- TLE propagation requires SGP4 algorithm
- Low data volume for selected satellites
- Consider using public APIs (CelesTrak) for easier access

---

## Data Source Priority Matrix

| Priority | Data Source | Implementation Effort | Impact on Phase 4 |
|----------|-------------|----------------------|-------------------|
| 🔴 **CRITICAL** | Geomagnetic Indices (Kp, Dst, AE) | 🟢 Low (1-2 days) | Essential for pattern detection |
| 🔴 **CRITICAL** | Radon Gas | 🟡 Medium (3-5 days) | Leading earthquake indicator |
| 🟡 **HIGH** | Ionospheric TEC | 🟡 Medium (2-3 days) | Ionospheric anomaly detection |
| 🟡 **HIGH** | Cosmic Ray (Neutron Monitors) | 🟢 Low (1-2 days) | Forbush decrease detection |
| 🟡 **HIGH** | Tsunami Warning | 🟢 Low (1 day) | Event validation |
| 🟢 **MEDIUM** | Lightning (WWLLN) | 🟡 Medium (2-3 days) | Atmospheric-seismic correlation |
| 🟢 **MEDIUM** | Ocean Indices (ENSO/NAO) | 🟢 Low (1 day) | Long-term climate context |
| 🟢 **MEDIUM** | Fire Detection (FIRMS) | 🟢 Low (1 day) | Atmospheric composition |
| 🟢 **LOW** | Gravity Field (GRACE-FO) | 🟡 Medium (2-3 days) | Monthly mass redistribution |
| 🟢 **LOW** | Tide Gauge | 🟡 Medium (2-3 days) | Sea level anomalies |
| 🟢 **LOW** | Satellite Telemetry | 🟡 Medium (2-3 days) | Rare anomalies |

---

## Implementation Roadmap

### Phase 4A: Critical Data Sources (Before Intelligence Layer)
1. **Geomagnetic Indices** — 1-2 days
   - Collector for Kp, Dst, AE indices
   - Table `geomagnetic_indices` already exists
   - Enables: Solar wind → geomagnetic response → seismic correlation

2. **Cosmic Ray** — 1-2 days
   - Collector for neutron monitor data
   - New table `cosmic_ray_data`
   - Enables: Forbush decrease detection, earthquake precursor analysis

### Phase 4B: High Priority Data Sources (Parallel with Intelligence Layer)
3. **Ionospheric TEC** — 2-3 days
   - Collector for TEC data (NASA JPL or Madrigal)
   - New table `ionospheric_tec`
   - Enables: Ionospheric anomaly detection

4. **Tsunami Warning** — 1 day
   - Collector for NOAA tsunami alerts
   - New table `tsunami_warnings`
   - Enables: Event validation, safety context

### Phase 4C: Medium Priority Data Sources (After Intelligence Layer)
5. **Lightning** — 2-3 days
6. **Ocean Indices** — 1 day
7. **Fire Detection** — 1 day

### Phase 4D: Low Priority Data Sources (Future Enhancement)
8. **Radon Gas** — 3-5 days (requires research network integration)
9. **Gravity Field** — 2-3 days
10. **Tide Gauge** — 2-3 days
11. **Satellite Telemetry** — 2-3 days

---

## Data Source Dependencies

```
Solar Wind (DSCOVR)
    ↓
Geomagnetic Indices (Kp, Dst, AE) ← CRITICAL MISSING LINK
    ↓
Ionospheric TEC ← Ionospheric response
    ↓
Seismic Activity (USGS)
    ↑
Cosmic Ray (Neutron Monitors) ← Forbush decreases
    ↑
Radon Gas ← Earthquake precursor
```

**Key Insight:** Geomagnetic indices are the missing link between solar wind and seismic activity. Without this data, pattern detection will be incomplete.

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
