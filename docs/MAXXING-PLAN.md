# TETHYS — Maxxing Plan: Full Potential Specification

## Overview

Dokumen ini mendefinisikan enam jalur ekspansi tambahan yang membawa Tethys melampaui perencanaan Phase X yang sudah ada. Jika Phase 1-5 dan Track 1-4 membangun fondasi yang solid, dokumen ini adalah tentang **mengubah Tethys dari "dashboard monitoring yang keren" menjadi "platform intelijen planet yang tidak ada tandingannya"**.

Setiap jalur dirancang untuk **zero-budget** dan dapat diimplementasikan secara incremental tanpa mengganggu sistem yang sudah berjalan.

**Target:** Mengubah Tethys dari *research observatory* menjadi *planetary intelligence platform* dengan ekosistem developer, aksesibilitas mobile, causal reasoning, dan state-of-the-art AI.

---

## Ringkasan Track

| Track | Nama | Impact | Effort | Prioritas |
|-------|------|--------|--------|-----------|
| **6** | Foundation Models for Time-Series | 🔴 Sangat Tinggi | 🟡 Sedang (4 minggu) | **P1** |
| **7** | Knowledge Graph + Causal Reasoning | 🔴 Sangat Tinggi | 🟡 Sedang (3 minggu) | **P1** |
| **8** | Citizen Science / IoT Integration | 🟡 Tinggi | 🟡 Sedang (3 minggu) | **P2** |
| **9** | PWA + Push Notifications | 🟡 Tinggi | 🟢 Rendah (1 minggu) | **P1** |
| **10** | Public API + Developer Ecosystem | 🟡 Tinggi | 🟢 Rendah (1 minggu) | **P1** |
| **11** | Physics-Based Simulation (Partial) | 🟡 Sedang | 🔴 Tinggi (6+ minggu) | **P3** |

---

---

# TRACK 6: Foundation Models for Time-Series Forecasting

## Masalah dengan Pendekatan Sekarang

Di `DATA-PREDICTIVE-MATRIX.md`, arsitektur model yang direncanakan adalah **Informer, Autoformer, atau PatchTST**. Ini adalah arsitektur 2021-2023 yang harus di-*train* dari nol.

Masalahnya:
- Data Tethys baru terkumpul beberapa bulan. Model transformer butuh **bertahun-tahun** data untuk converge.
- Training dari nol butuh GPU berhari-hari (Colab free tier: 30h/week, sering timeout).
- Hyperparameter tuning sangat tricky — mudah overfit atau underfit.
- Setiap domain butuh model terpisah karena karakteristik data berbeda.

## Solusi: Time-Series Foundation Models

Foundation models yang sudah di-*pre-train* di **jutaan time series** dari berbagai domain. Mereka bisa langsung melakukan zero-shot atau few-shot forecasting tanpa training ulang.

## Model yang Direkomendasikan

| Model | Developer | Arsitektur | Keunggulan | Lisensi |
|-------|-----------|------------|------------|---------|
| **TimesFM** | Google Research | Decoder-only transformer (200M params) | Pre-trained di 100B+ time points. Zero-shot langsung akurat. | Apache 2.0 |
| **Chronos** | Amazon Science | Based on T5 (encoder-decoder) | Tokenizes time-series. Fine-tune sedikit data langsung bagus. | Apache 2.0 |
| **Moirai** | Salesforce AI Research | Masked encoder transformer | Multi-resolution. Satu model untuk semua domain. | BSD-3 |
| **Timer-XL** | Tsinghua University | GPT-style generative | SOTA di multiple benchmarks. Probabilistic forecasting. | MIT |

## Arsitektur Integrasi

```
┌─────────────────────────────────────────────────────────────┐
│              FOUNDATION MODEL LAYER                           │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Inference   │  │   Fine-tune  │  │   Ensemble       │  │
│  │   Engine      │  │   Pipeline   │  │   Aggregator     │  │
│  │              │  │              │  │                  │  │
│  │ TimesFM      │  │ Chronos      │  │ Weighted vote    │  │
│  │ (zero-shot)  │  │ (few-shot    │  │ across models    │  │
│  │              │  │  per domain) │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         └──────────────────┴────────────────────┘            │
│                          │                                   │
│                   ┌──────┴───────┐                           │
│                   │  Prediction  │                           │
│                   │  Results DB  │                           │
│                   └──────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

## Implementasi Bertahap

### Tahap 1: Zero-Shot Inference (1 minggu)

```python
# backend/forecasting/timesfm_engine.py

import timesfm
import numpy as np

class TimesFMForecaster:
    """Zero-shot forecasting menggunakan Google TimesFM.
    
    KEUNGGULAN: Tidak perlu training. Langsung bisa forecast
    solar wind, seismic energy, atmospheric pressure dengan
    model yang sudah pre-trained di 100B+ data points.
    
    INFERENCE: Bisa jalan di CPU (lambat tapi works) atau
    di Google Colab / Modal.com free tier (GPU).
    """
    
    def __init__(self):
        self.model = timesfm.TimesFm(
            hparams=timesfm.TimesFmHparams(
                per_core_batch_size=32,
                horizon_len=128,
                num_layers=50,
            ),
            checkpoint=timesfm.TimesFmCheckpoint(
                huggingface_repo_id="google/timesfm-2.0-500m-pytorch"
            ),
        )
        self.model.load_from_checkpoint(repo_id="google/timesfm-2.0-500m-pytorch")
    
    async def forecast_metric(self, pool, table, metric, horizon_hours=24):
        """Forecast a specific metric from TimescaleDB."""
        query = f"""
            SELECT time, {metric}
            FROM {table}
            WHERE time > NOW() - INTERVAL '30 days'
            ORDER BY time
        """
        async with pool.acquire() as conn:
            rows = await conn.fetch(query)
        
        if len(rows) < 50:
            return None
        
        values = np.array([r[metric] for r in rows])
        forecast_input = [values.tolist()]
        
        # Run inference (CPU: ~10s, GPU: ~0.5s)
        point_forecasts, _ = self.model.forecast(
            forecast_input,
            freq=[0] * len(forecast_input),
        )
        
        return {
            'forecast': point_forecasts[0][:horizon_hours].tolist(),
            'horizon_hours': horizon_hours,
            'model': 'timesfm-2.0-500m',
            'method': 'zero_shot',
        }
```

### Tahap 2: Domain-Specific Fine-Tuning (2 minggu)

```python
# backend/forecasting/chronos_finetune.py

class ChronosDomainFinetuner:
    """Fine-tune Amazon Chronos per domain.
    
    KENAPA PER DOMAIN:
    - Seismic data: power-law distribution, sparse events
    - Solar wind: quasi-periodic, strong diurnal patterns
    - Atmospheric: smooth, seasonal trends
    
    Satu model universal tidak cukup. Fine-tune Chronos
    dengan 1000-5000 data points per domain sudah cukup
    untuk adaptasi yang signifikan.
    
    TRAINING: Google Colab T4 (free), ~2-4 jam per domain.
    """
    
    DOMAINS = {
        'seismic': {
            'tables': ['seismic_events'],
            'metrics': ['magnitude', 'event_count_hourly'],
            'finetune_epochs': 50,
            'learning_rate': 1e-5,
        },
        'solar_wind': {
            'tables': ['solar_wind'],
            'metrics': ['speed', 'density', 'bt', 'bz_gsm'],
            'finetune_epochs': 30,
            'learning_rate': 5e-5,
        },
        'goes': {
            'tables': ['goes_flux'],
            'metrics': ['flux'],
            'finetune_epochs': 30,
            'learning_rate': 5e-5,
        },
        'atmospheric': {
            'tables': ['atmospheric_data'],
            'metrics': ['temperature', 'wind_speed', 'pressure'],
            'finetune_epochs': 20,
            'learning_rate': 1e-4,
        },
    }
```

### Tahap 3: Ensemble Forecasting (1 minggu)

```python
# backend/forecasting/ensemble.py

class EnsembleForecaster:
    """Combine predictions from multiple foundation models.
    
    ENSEMBLE STRATEGY:
    - Simple average: robust, reduces variance
    - Weighted by recent accuracy: adapts to which model
      is performing best per domain
    - Prediction intervals: use disagreement between models
      as uncertainty estimate
    """
    
    async def ensemble_forecast(self, domain, metric, horizon_hours):
        results = await asyncio.gather(
            self.timesfm.forecast(domain, metric, horizon_hours),
            self.chronos.forecast(domain, metric, horizon_hours),
            self.moirai.forecast(domain, metric, horizon_hours),
        )
        
        valid = [r for r in results if r is not None]
        if not valid:
            return None
        
        weights = await self._get_domain_weights(domain, metric)
        ensemble = np.average(
            [r['forecast'] for r in valid],
            weights=weights[:len(valid)],
            axis=0,
        )
        
        uncertainty = np.std([r['forecast'] for r in valid], axis=0)
        
        return {
            'forecast': ensemble.tolist(),
            'confidence': (1.0 / (1.0 + np.mean(uncertainty))).item(),
            'model_count': len(valid),
            'horizon_hours': horizon_hours,
        }
```

## Database Schema (New Table)

```sql
CREATE TABLE forecasts (
    time              TIMESTAMPTZ NOT NULL,
    forecast_id       TEXT NOT NULL,
    domain            TEXT NOT NULL,
    metric            TEXT NOT NULL,
    model_name        TEXT NOT NULL,
    horizon_hours     INTEGER NOT NULL,
    forecast_values   JSONB NOT NULL,
    confidence        REAL,
    actual_values     JSONB,
    mae               REAL,
    PRIMARY KEY (time, forecast_id)
);

SELECT create_hypertable('forecasts', 'time');
CREATE INDEX ON forecasts (domain, metric, time DESC);
CREATE INDEX ON forecasts (model_name, time DESC);
```

## Deployment Strategy

| Environment | Use Case | Cost |
|-------------|----------|------|
| **VPS (CPU)** | TimesFM inference (slow, ~10s per forecast) | $0 (existing) |
| **Google Colab** | Fine-tuning per domain, batch inference | $0 (30h/week GPU) |
| **Modal.com** | On-demand GPU inference (serverless) | $0 (free tier: 30h GPU/month) |
| **Kaggle Notebooks** | Alternative to Colab, 30h/week GPU | $0 |

## Estimasi Effort

| Tahap | Durasi | Output |
|-------|--------|--------|
| Tahap 1: Zero-shot inference | 1 minggu | TimesFM running, forecast semua domain |
| Tahap 2: Fine-tuning per domain | 2 minggu | Chronos adapted ke data Tethys |
| Tahap 3: Ensemble + confidence | 1 minggu | Multi-model aggregation |
| **Total** | **4 minggu** | Production-ready forecasting layer |

---

---

# TRACK 7: Knowledge Graph untuk Causal Reasoning

## Masalah dengan Pendekatan Sekarang

Sistem analisis Tethys sekarang purely **statistical**:

```
SEKARANG:
  "Solar wind Bz southward correlates with seismic activity (r=0.3, p<0.05)"
  
  → So what? Correlation ≠ causation. Tidak menjelaskan MEKANISME.
  → Tidak bisa menjawab "kenapa" atau "bagaimana".
  → Narrative generator (Phase 4) hanya bisa bilang "correlation detected".
```

## Solusi: Knowledge Graph + Causal Inference

Build **graph pengetahuan fisika planet** dari research papers, lalu gunakan untuk:
1. **Ground** statistical correlations ke mekanisme fisik yang diketahui
2. **Infer** causal chains: "A → B → C karena mekanisme X"
3. **Generate** narrative yang explainable, bukan cuma "anomaly detected"

## Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│              KNOWLEDGE GRAPH LAYER                            │
│                                                              │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │  Physics Graph    │    │  Causal Inference Engine     │   │
│  │  (NetworkX →      │    │                              │   │
│  │   Neo4j)          │    │  Granger causality           │   │
│  │                   │    │  + Graph paths               │   │
│  │  Nodes:           │    │  = Causal chains             │   │
│  │  - Domains        │    │                              │   │
│  │  - Metrics        │    │  "Solar wind → magnetopause  │   │
│  │  - Mechanisms     │    │   compression → FAC → TEC    │   │
│  │  - Papers         │    │   anomaly → seismic stress"  │   │
│  │                   │    │                              │   │
│  │  Edges:           │    └──────────────────────────────┘   │
│  │  - causes         │                                       │
│  │  - correlates_with│    ┌──────────────────────────────┐   │
│  │  - modulated_by   │    │  Narrative Enhancer          │   │
│  │  - observed_in    │    │                              │   │
│  │                   │    │  Query graph → enrich        │   │
│  └──────────────────┘    │  Phase 4 narratives with     │   │
│                           │  causal mechanisms from      │   │
│                           │  papers                      │   │
│                           └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Graph Schema

### Node Types

| Node Type | Contoh | Properties |
|-----------|--------|------------|
| `:Domain` | solar_wind, geomagnetic, ionospheric, seismic, atmospheric | name, description |
| `:Metric` | bz_gsm, kp_index, tec_anomaly, magnitude | name, domain, unit, cadence |
| `:Mechanism` | magnetopause_compression, piezoelectric_effect | name, description, confidence |
| `:Paper` | "Nature Sci Reports 2020" | title, authors, doi, year |
| `:Zone` | pacific_ring_of_fire, japan_trench | name, geometry, tectonic_context |

### Edge Types

| Edge Type | Contoh | Properties |
|-----------|--------|------------|
| `CAUSES` | bz_gsm → magnetopause_compression | confidence (0-1), lag_hours, source |
| `CORRELATES_WITH` | solar_activity → seismic_energy | strength, significance, dataset |
| `MODULATED_BY` | seismic_stress → fault_zone_orientation | mechanism_description |
| `DESCRIBED_IN` | mechanism → paper | page, section |
| `INVOLVES` | mechanism → metric | role (trigger, mediator, outcome) |
| `OCCURS_IN` | mechanism → zone | frequency, conditions |

## Contoh Causal Chain (LAIC Theory)

```
Solar Wind Bz (southward)
    │
    ├──[CAUSES]──→ Magnetopause Compression
    │                   │
    │                   ├──[CAUSES]──→ Field-Aligned Currents (FAC)
    │                   │                   │
    │                   │                   └──[CAUSES]──→ Ionospheric TEC Anomaly
    │                   │
    │                   └──[CAUSES]──→ Geomagnetic Kp/Dst Increase
    │
    └──[CORRELATES_WITH]──→ Seismic Energy Release (via lithospheric stress)
                                  │
                                  └──[MODULATED_BY]──→ Fault Zone Orientation
                                  └──[MODULATED_BY]──→ Tidal Stress Phase
```

## Implementasi

### Tahap 1: Graph Database Setup (3 hari)

```python
# backend/knowledge/graph_init.py
# Mulai dengan NetworkX (in-memory, ringan, zero infra).
# Migrate ke Neo4j Community (free) kalau graph >50K nodes.

import networkx as nx
import numpy as np

class PlanetaryKnowledgeGraph:
    """Knowledge graph of planetary physics mechanisms.
    
    INITIAL SEED: ~200 nodes, ~500 edges dari review papers.
    GROWS: Setiap kali korelasi baru dikonfirmasi dengan mekanisme fisik,
    edge baru ditambahkan.
    """
    
    def __init__(self):
        self.G = nx.DiGraph()
        self._seed_from_laic_theory()
        self._seed_from_space_weather_chain()
        self._seed_from_volcanic_atmospheric()
    
    def _seed_from_laic_theory(self):
        """Seed graph dengan LAIC chain."""
        self.G.add_node('bz_gsm', domain='solar_wind', type='metric')
        self.G.add_node('magnetopause_compression', type='mechanism',
                       description='Southward Bz compresses dayside magnetopause')
        self.G.add_edge('bz_gsm', 'magnetopause_compression',
                       relation='causes', confidence=0.95,
                       source='Dungey cycle, established physics')
        
        self.G.add_node('fac_intensity', domain='geomagnetic', type='metric')
        self.G.add_edge('magnetopause_compression', 'fac_intensity',
                       relation='causes', confidence=0.90)
        
        self.G.add_node('tec_anomaly', domain='ionospheric', type='metric')
        self.G.add_edge('fac_intensity', 'tec_anomaly',
                       relation='causes', confidence=0.80,
                       source='Pulinets & Boyarchuk 2004')
        self.G.add_edge('tec_anomaly', 'seismic_stress',
                       relation='correlates_with', confidence=0.40,
                       source='Nature Sci Reports 2020, controversial')
    
    def find_causal_path(self, source_metric, target_metric, max_hops=5):
        """Find all causal paths between two metrics."""
        paths = list(nx.all_simple_paths(
            self.G, source_metric, target_metric, cutoff=max_hops
        ))
        
        return [{
            'path': path,
            'mechanisms': [self.G.nodes[n].get('description', '') for n in path],
            'total_confidence': np.prod([
                self.G.edges[path[i], path[i+1]].get('confidence', 0.5)
                for i in range(len(path)-1)
            ]),
            'papers': self._get_supporting_papers(path),
        } for path in paths]
    
    def explain_correlation(self, domain_a, metric_a, domain_b, metric_b):
        """Generate human-readable causal explanation."""
        paths = self.find_causal_path(metric_a, metric_b)
        
        if not paths:
            return {
                'explanation': f'No known physical mechanism connects {metric_a} to {metric_b}.',
                'confidence': 'low',
            }
        
        best_path = max(paths, key=lambda p: p['total_confidence'])
        chain = ' → '.join(best_path['path'])
        
        return {
            'explanation': f'Correlation explained by: {chain}.',
            'causal_chain': best_path['path'],
            'mechanisms': best_path['mechanisms'],
            'papers': best_path['papers'],
            'confidence': 'high' if best_path['total_confidence'] > 0.6 else 'medium',
        }
```

### Tahap 2: Integration dengan Narrative Generator (1 minggu)

```python
# backend/analysis/narrative_enhancer.py

class NarrativeEnhancer:
    """Enhance Phase 4 narratives with causal reasoning.
    
    SEBELUM:
    "Anomaly detected: Bz dropped to -15nT. Seismic activity increased.
     Correlation: r=0.35."
    
    SESUDAH:
    "Anomaly detected: Bz dropped to -15nT. Seismic activity increased.
     Correlation: r=0.35.
     
     Possible mechanism: Bz southward → magnetopause compression → 
     FAC → TEC anomaly → lithospheric stress (LAIC coupling).
     Confidence: medium (0.38).
     Reference: Pulinets & Boyarchuk 2004."
    """
    
    def __init__(self, knowledge_graph, narrative_generator):
        self.kg = knowledge_graph
        self.ng = narrative_generator
    
    async def generate_enhanced_narrative(self, anomalies, correlations):
        base_narrative = await self.ng.generate(anomalies, correlations)
        
        causal_explanations = []
        for corr in correlations:
            if corr['is_significant']:
                explanation = self.kg.explain_correlation(
                    corr['domain_a'], corr['metric_a'],
                    corr['domain_b'], corr['metric_b'],
                )
                causal_explanations.append(explanation)
        
        enhanced = base_narrative.copy()
        enhanced['causal_context'] = causal_explanations
        enhanced['body'] = self._integrate_causal_context(
            base_narrative['body'], causal_explanations
        )
        return enhanced
```

### Tahap 3: Graph Growth Engine (1 minggu)

```python
# backend/knowledge/graph_growth.py

class GraphGrowthEngine:
    """Auto-detect unexplained correlations for literature review.
    
    Feedback loop:
    Data → Correlation → Graph Query → (no path found) → 
    Literature Search → Human Review → New Edge → 
    Future narratives enriched
    """
    
    async def check_unexplained_correlations(self, pool):
        """Find significant correlations not in the graph."""
        query = """
            SELECT domain_a, metric_a, domain_b, metric_b, pearson_r, p_value
            FROM correlations
            WHERE is_significant = true
            AND time > NOW() - INTERVAL '30 days'
            ORDER BY ABS(pearson_r) DESC
        """
        async with pool.acquire() as conn:
            rows = await conn.fetch(query)
        
        unexplained = []
        for row in rows:
            paths = self.kg.find_causal_path(row['metric_a'], row['metric_b'])
            if not paths:
                unexplained.append({
                    'correlation': dict(row),
                    'status': 'unexplained — needs literature review',
                })
        
        return unexplained
```

## Database Options

| Option | RAM | Pros | Cons | Recommendation |
|--------|-----|------|------|----------------|
| **NetworkX** (in-memory) | ~50MB | Zero infra, fast for <10K nodes | Not persistent, no query language | **Start here** |
| **Neo4j Community** | ~512MB | Cypher query language, persistent, visualization | Needs Docker container | Migrate at >10K nodes |
| **Apache Jena** | ~256MB | RDF/SPARQL, academic standard | More complex setup | Only if need RDF interop |

## Estimasi Effort

| Tahap | Durasi | Output |
|-------|--------|--------|
| Tahap 1: Graph setup + seed data | 1 minggu | ~200 nodes, ~500 edges |
| Tahap 2: Narrative integration | 1 minggu | Phase 4 narratives enhanced |
| Tahap 3: Graph growth engine | 1 minggu | Auto-detect unexplained correlations |
| **Total** | **3 minggu** | Causal reasoning layer operational |

---

---

# TRACK 8: Citizen Science / IoT Integration

## Konsep

Data Tethys sekarang dari satelit dan stasiun resmi. Tapi ada **jutaan sensor pribadi** di seluruh dunia yang bisa enrich data. Track ini membuka Tethys untuk menerima data dari komunitas citizen science, meningkatkan data density dari ~150 points menjadi **10,000+ points**.

## Sumber Data Citizen Science

| Sumber | Data | Format | API | Free? | Data Quality |
|--------|------|--------|-----|-------|--------------|
| **Raspberry Shake** | Personal seismographs | JSON/CSV | REST + FDSN | ✅ | 🟢 Good (calibrated) |
| **Weather Underground (PWS)** | Suhu, tekanan, angin hyperlocal | JSON | REST API | ✅ (limited) | 🟡 Variable |
| **Quake-Catcher Network** | Accelerometer dari laptop/HP | JSON | REST API | ✅ | 🟡 Variable |
| **OpenWeatherMap PWS** | Same as WU, different provider | JSON | REST API | ✅ (limited) | 🟡 Variable |
| **Safecast** | Radiation monitoring (Geiger counters) | JSON | REST API | ✅ | 🟢 Good |

## Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│              CITIZEN SCIENCE LAYER                            │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Raspberry   │  │  Weather     │  │  Quake-Catcher   │  │
│  │  Shake       │  │  Underground │  │  Network         │  │
│  │  (seismic)   │  │  (PWS)       │  │  (accelerometer) │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         └──────────────────┴────────────────────┘            │
│                          │                                   │
│                   ┌──────┴───────┐                           │
│                   │   Quality    │                           │
│                   │   Gate       │                           │
│                   │              │                           │
│                   │ - Range      │                           │
│                   │   check      │                           │
│                   │ - Spatial    │                           │
│                   │   consistency│                           │
│                   │ - Station    │                           │
│                   │   reputation │                           │
│                   └──────┬───────┘                           │
│                          │                                   │
│                   ┌──────┴───────┐                           │
│                   │  TimescaleDB │                           │
│                   │  (new tables)│                           │
│                   └──────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema (New Tables)

```sql
-- Citizen seismic data
CREATE TABLE citizen_seismic (
    time            TIMESTAMPTZ NOT NULL,
    station_id      TEXT NOT NULL,
    station_name    TEXT,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    elevation_m     REAL,
    acceleration    REAL,
    velocity        REAL,
    source          TEXT NOT NULL,
    quality_flag    TEXT DEFAULT 'good',
    PRIMARY KEY (time, station_id)
);

SELECT create_hypertable('citizen_seismic', 'time');
CREATE INDEX ON citizen_seismic (source, time DESC);

-- Citizen weather data
CREATE TABLE citizen_weather (
    time            TIMESTAMPTZ NOT NULL,
    station_id      TEXT NOT NULL,
    latitude        REAL NOT NULL,
    longitude       REAL NOT NULL,
    temperature     REAL,
    pressure        REAL,
    humidity        REAL,
    wind_speed      REAL,
    wind_dir        REAL,
    precipitation   REAL,
    source          TEXT NOT NULL,
    quality_flag    TEXT DEFAULT 'good',
    PRIMARY KEY (time, station_id)
);

SELECT create_hypertable('citizen_weather', 'time');
CREATE INDEX ON citizen_weather (source, time DESC);
```

## Quality Gate

```python
# backend/collectors/citizen_quality.py

class CitizenDataQualityGate:
    """Validate citizen science data before ingestion.
    
    CHECKS:
    1. Range check — values within physically possible bounds
    2. Spatial consistency — compare with nearby official stations
    3. Temporal consistency — sudden jumps flagged
    4. Station reputation — new stations start with low trust
    """
    
    RANGE_LIMITS = {
        'temperature': (-90, 60),
        'pressure': (870, 1084),
        'wind_speed': (0, 400),
        'acceleration': (0, 10),
        'humidity': (0, 100),
    }
    
    async def validate(self, reading, station_reputation):
        """Validate a single citizen reading."""
        checks = []
        
        # 1. Range check
        for metric, (lo, hi) in self.RANGE_LIMITS.items():
            value = reading.get(metric)
            if value is not None and not (lo <= value <= hi):
                return {'valid': False, 'reason': f'{metric} out of range'}
        
        # 2. Spatial consistency (compare with nearest official station)
        spatial_deviation = await self._check_spatial_consistency(reading)
        if spatial_deviation > 3.0:  # >3σ from nearby official
            checks.append('spatial_outlier')
        
        # 3. Temporal consistency
        temporal_jump = await self._check_temporal_consistency(reading)
        if temporal_jump:
            checks.append('temporal_jump')
        
        # 4. Reputation weighting
        trust_score = station_reputation.get(reading['station_id'], 0.5)
        
        if len(checks) > 1 and trust_score < 0.7:
            return {'valid': False, 'reason': f'Failed checks: {checks}, low trust'}
        
        quality = 'good' if not checks else 'suspect'
        return {'valid': True, 'quality_flag': quality, 'trust_score': trust_score}
```

## Frontend: Citizen Station Map

```tsx
// frontend/src/components/citizen/CitizenStationMap.tsx
// Visualisasi citizen stations di globe — beda warna dari official stations

// Official stations: amber (#f5a623)
// Citizen stations: cyan (#00bcd4) — distinguishable, same family
// Quality: good = solid, suspect = dashed ring, rejected = hidden
```

## Estimasi Effort

| Tahap | Durasi | Output |
|-------|--------|--------|
| Tahap 1: Raspberry Shake collector | 1 minggu | Personal seismic data flowing |
| Tahap 2: PWS collector + quality gate | 1 minggu | Weather Underground data |
| Tahap 3: Globe visualization | 1 minggu | Citizen stations on globe |
| **Total** | **3 minggu** | 10,000+ data points |

---

---

# TRACK 9: PWA + Push Notifications

## Konsep

Dashboard Tethys sekarang desktop-only. Tapi planetary events terjadi 24/7 — orang butuh **notifikasi di HP** saat anomaly terdeteksi. Track ini mengubah Tethys jadi **Progressive Web App** yang bisa di-install di HP dan kirim push notification.

## Fitur

```
PWA (Progressive Web App):
├── Installable di HP (Add to Home Screen)
├── Icon + splash screen branded Tethys
├── Push notification saat Lament Detector aktif
├── Offline mode (cache last known state)
├── Responsive globe (touch controls)
├── Service Worker untuk background sync
└── $0 — tidak perlu native app
```

## Implementasi

### 1. Vite PWA Plugin (3 hari)

```typescript
// frontend/vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'TETHYS — Planetary Intelligence System',
        short_name: 'TETHYS',
        description: 'Real-time planetary monitoring dashboard',
        theme_color: '#050a0f',
        background_color: '#050a0f',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.tethys\.web\.id\/api\/v1\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
})
```

### 2. Push Notifications via WebSocket (3 hari)

```typescript
// frontend/src/hooks/usePushNotifications.ts

export function usePushNotifications() {
  const subscribe = async () => {
    const registration = await navigator.serviceWorker.ready;
    
    // Subscribe to push (using VAPID keys — free, no Firebase needed)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    
    // Send subscription to backend
    await fetch('/api/v1/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    });
  };
  
  return { subscribe };
}

// backend/api/routes/push.py
# VAPID keys — generate once, free, no third-party service needed
# web-push library handles the push protocol

from webpush import WebPush
```

### 3. Offline Mode (1 hari)

```typescript
// Service Worker sudah handle caching.
// Tambahan: detect offline, show cached data with "OFFLINE" badge.
// Saat reconnect, auto-refresh data terbaru.
```

## Estimasi Effort

| Tahap | Durasi | Output |
|-------|--------|--------|
| Vite PWA plugin + manifest | 1 hari | Installable app |
| Push notifications | 2 hari | Alert saat anomaly |
| Offline mode + service worker | 2 hari | Works without internet |
| **Total** | **5 hari** | Mobile-ready PWA |

---

---

# TRACK 10: Public API + Developer Ecosystem

## Konsep

Sekarang Tethys cuma bisa diakses via UI. Kalau kamu buka **REST API publik** (dengan rate limiting), orang lain bisa build app di atas data Tethys, integrasi anomaly alerts, dan contribute analysis plugins. Tethys dari "project" jadi **"platform"**.

## API Endpoints (Public)

```
api.tethys.web.id/v1/
│
├── /events                    — Query semua events
│   ├── ?domain=seismic        — Filter by domain
│   ├── ?hours=24              — Time range
│   ├── ?min_magnitude=3.0     — Minimum magnitude
│   └── ?limit=100             — Pagination
│
├── /anomalies                 — Detected anomalies
│   ├── ?domain=solar_wind
│   ├── ?severity=high
│   └── ?hours=168
│
├── /correlations              — Cross-domain correlations
│   ├── ?significant_only=true
│   └── ?hours=720
│
├── /forecasts                 — Foundation model predictions (Track 6)
│   ├── ?domain=seismic
│   └── ?horizon=24
│
├── /narratives                — AI-generated reports (Phase 4 + Track 7)
│   ├── ?type=observation
│   └── ?severity=high
│
├── /status                    — System health + collector status
├── /activity                  — Activity index assessment
│
├── /ws                        — Real-time WebSocket stream
│
└── /docs                      — Swagger/OpenAPI (auto-generated by FastAPI)
    └── /redoc                 — Alternative API docs
```

## Rate Limiting & Access Control

```python
# backend/api/middleware/rate_limit.py

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# Rate limits — generous for free tier
# No API key needed for basic access
RATE_LIMITS = {
    'events': '60/minute',
    'anomalies': '30/minute',
    'correlations': '20/minute',
    'forecasts': '10/minute',
    'narratives': '10/minute',
    'ws': '5 connections per IP',
}

# Optional: API key for higher limits (free registration)
# Could use simple token-based auth, no OAuth needed
```

## Auto-Generated Documentation

```python
# FastAPI sudah support OpenAPI auto-generation
# Tinggal customize metadata

app = FastAPI(
    title="TETHYS API",
    description="Planetary Intelligence System — Real-time data, anomaly detection, and cross-domain correlation analysis.",
    version="1.0.0",
    contact={"name": "TETHYS Team", "url": "https://tethys.web.id"},
    license_info={"name": "MIT"},
    openapi_tags=[
        {"name": "events", "description": "Planetary events across all domains"},
        {"name": "anomalies", "description": "Detected statistical anomalies"},
        {"name": "correlations", "description": "Cross-domain correlation analysis"},
        {"name": "forecasts", "description": "AI-powered time-series forecasts"},
        {"name": "narratives", "description": "AI-generated investigative reports"},
    ],
)
```

## SDK / Client Libraries

```python
# PyPI package: tethys-client
# Simple Python client for the API

from tethys import TethysClient

client = TethysClient()  # defaults to api.tethys.web.id

# Get latest seismic events
events = client.events(domain='seismic', hours=24, min_magnitude=4.0)

# Stream anomalies via WebSocket
for anomaly in client.stream_anomalies():
    print(f"[{anomaly.domain}] {anomaly.metric}: z={anomaly.z_score:.1f}")
```

## Estimasi Effort

| Tahap | Durasi | Output |
|-------|--------|--------|
| Enable public routes + rate limiting | 2 hari | API accessible |
| OpenAPI docs customization | 1 hari | Swagger/ReDoc |
| Python client library | 2 hari | pip install tethys-client |
| **Total** | **5 hari** | Developer ecosystem |

---

---

# TRACK 11: Physics-Based Simulation (Partial)

## Konsep

Track 3 (Simulator) fokus ke UI — user inject anomali, lihat visual effect. Track 11 menambahkan **actual physics simulation** di balik visual effect tersebut. Bukan cuma "slider → gambar berubah", tapi **persamaan fisika yang dihitung real-time**.

## Scope: Tsunami Propagation Only

Full physics simulation (seismic wave FEM, MHD magnetosphere) terlalu berat untuk scope ini. Fokus ke **satu simulasi yang paling feasible dan impactful**: tsunami propagation menggunakan **shallow water equations** di WebGPU.

### Kenapa Tsunami?

- Data input sudah ada (USGS seismic events di laut)
- Bathymetry data gratis (ETOPO1 dari NOAA)
- Persamaan relatif sederhana (shallow water eq.)
- Visual impact tinggi di globe
- Bisa dijalankan di WebGPU (Track 4 synergy)

## Persamaan: Shallow Water Equations

```
∂η/∂t + ∇·(h·u) = 0              (continuity / mass conservation)
∂u/∂t + (u·∇)u = -g·∇η - τ·u     (momentum, linearized)

Where:
  η = surface elevation (what we want to visualize)
  h = water depth (from bathymetry)
  u = velocity vector
  g = gravitational acceleration
  τ = friction coefficient
```

## Implementasi di WebGPU (WGSL Compute Shader)

```wgsl
// frontend/src/shaders/tsunami_simulation.wgsl

@group(0) @binding(0) var<storage, read> bathymetry: array<f32>;  // ocean depth grid
@group(0) @binding(1) var<storage, read_write> elevation: array<f32>;  // η
@group(0) @binding(2) var<storage, read_write> velocity_x: array<f32>;  // u
@group(0) @binding(3) var<storage, read_write> velocity_y: array<f32>;  // v

struct Params {
    grid_size: u32,
    dx: f32,        // grid spacing (meters)
    dt: f32,        // time step (seconds)
    gravity: f32,   // 9.81
    friction: f32,  // 0.01
}
@group(0) @binding(4) var<uniform> params: Params;

@compute @workgroup_size(16, 16)
fn update_elevation(@builtin(global_invocation_id) id: vec3<u32>) {
    let x = id.x;
    let y = id.y;
    let n = params.grid_size;
    
    if (x >= n || y >= n) { return; }
    
    let idx = y * n + x;
    
    // Finite difference: ∇·(h·u)
    let h = bathymetry[idx];
    let ux = velocity_x[idx];
    let uy = velocity_y[idx];
    
    let idx_right = y * n + min(x + 1, n - 1);
    let idx_up = min(y + 1, n - 1) * n + x;
    
    let dux_dx = (velocity_x[idx_right] - ux) / params.dx;
    let duy_dy = (velocity_y[idx_up] - uy) / params.dx;
    
    // η(t+1) = η(t) - dt * ∇·(h*u)
    elevation[idx] = elevation[idx] - params.dt * h * (dux_dx + duy_dy);
}

@compute @workgroup_size(16, 16)
fn update_velocity(@builtin(global_invocation_id) id: vec3<u32>) {
    let x = id.x;
    let y = id.y;
    let n = params.grid_size;
    
    if (x >= n || y >= n) { return; }
    
    let idx = y * n + x;
    
    // Finite difference: ∇η
    let idx_left = y * n + max(x, 1) - 1;
    let idx_down = max(y, 1) - 1 * n + x;
    
    let deta_dx = (elevation[idx] - elevation[idx_left]) / params.dx;
    let deta_dy = (elevation[idx] - elevation[idx_down]) / params.dx;
    
    // u(t+1) = u(t) + dt * (-g*∇η - τ*u)
    velocity_x[idx] = velocity_x[idx] + params.dt * (-params.gravity * deta_dx - params.friction * velocity_x[idx]);
    velocity_y[idx] = velocity_y[idx] + params.dt * (-params.gravity * deta_dy - params.friction * velocity_y[idx]);
}
```

## Data Requirements

| Data | Source | Format | Size | Free? |
|------|--------|--------|------|-------|
| Bathymetry (ETOPO1) | NOAA | NetCDF | ~500MB global | ✅ |
| Initial displacement | USGS seismic events | JSON | <1KB per event | ✅ |

## Integration dengan Globe

```tsx
// frontend/src/components/simulation/TsunamiLayer.tsx
// Render tsunami wave propagation on R3F globe

// 1. User clicks a submarine earthquake event on globe
// 2. Extract epicenter + magnitude → compute initial displacement
// 3. Load bathymetry for region (pre-cached tiles)
// 4. Run WGSL compute shader each frame
// 5. Render elevation as transparent wave overlay on globe surface
// 6. Wave propagates in real-time, respects ocean depth
```

## Estimasi Effort

| Tahap | Durasi | Output |
|-------|--------|--------|
| Bathymetry data pipeline | 1 minggu | ETOPO1 tiles loaded |
| WGSL compute shader | 2 minggu | Shallow water simulation running |
| Globe integration (R3F) | 1 minggu | Wave overlay on globe |
| UI controls (inject earthquake) | 1 minggu | Click event → simulate |
| **Total** | **5 minggu** | Physics-accurate tsunami simulation |

---

---

# IMPLEMENTATION ROADMAP

## Urutan yang Direkomendasikan

```
WEEK 1-2:   Track 9  (PWA + Push)          ← Quick win, mobile-ready
WEEK 3:     Track 10 (Public API)            ← Quick win, developer ecosystem
WEEK 4-7:   Track 6  (Foundation Models)     ← AI upgrade, high impact
WEEK 8-10:  Track 7  (Knowledge Graph)       ← Causal reasoning, narratives
WEEK 11-13: Track 8  (Citizen Science)       ← Data density boost
WEEK 14+:   Track 11 (Physics Sim, partial)  ← Flex, high effort
```

## Total Timeline

| Track | Durasi | Kumulatif |
|-------|--------|-----------|
| Track 9 (PWA) | 1 minggu | Week 1 |
| Track 10 (API) | 1 minggu | Week 2 |
| Track 6 (Foundation Models) | 4 minggu | Week 6 |
| Track 7 (Knowledge Graph) | 3 minggu | Week 9 |
| Track 8 (Citizen Science) | 3 minggu | Week 12 |
| Track 11 (Physics Sim) | 5 minggu | Week 17 |
| **Total** | **~17 minggu** | **~4 bulan** |

## Cost Summary

| Item | Cost |
|------|------|
| Semua tools & libraries | **$0** (open source) |
| GPU training (Colab/Modal) | **$0** (free tiers) |
| Data sources | **$0** (all free APIs) |
| VPS | **$0** (existing) |
| Domain | **$0** (existing tethys.web.id) |
| **TOTAL** | **$0** |

## Full System Architecture (After All Tracks)

```
┌─────────────────────────────────────────────────────────────────┐
│                    TETHYS — FULL ARCHITECTURE                     │
│                                                                   │
│  DATA SOURCES (15+)                                               │
│  ├── Official: USGS, NOAA, NASA, Open-Meteo, GVP (7 collectors)  │
│  ├── Precursor: INTERMAGNET, FIRMS, Global TEC (3 collectors)    │
│  ├── Citizen: Raspberry Shake, PWS, QCN (3+ collectors)          │
│  └── Visual: Himawari-9, GOES-16 (satellite imagery)             │
│                                                                   │
│  DATABASE                                                         │
│  └── TimescaleDB (hypertables + continuous aggregates)           │
│                                                                   │
│  ANALYSIS                                                         │
│  ├── Statistical: Z-score, correlation, Granger, TE, wavelet     │
│  ├── AI: Foundation models (TimesFM, Chronos, Moirai ensemble)   │
│  └── Causal: Knowledge graph + narrative enhancer                │
│                                                                   │
│  INTELLIGENCE                                                     │
│  ├── Pattern memory (Phase 4)                                    │
│  ├── Narrative generator + causal reasoning (Phase 4 + Track 7)  │
│  ├── Lament detector (Phase 4)                                   │
│  └── Vision: YOLOv12 satellite image analysis (Track 2)          │
│                                                                   │
│  VISUALIZATION                                                    │
│  ├── Custom 3D engine (R3F + GSAP) — Track 1 ✅                  │
│  ├── Physics simulation (WebGPU tsunami) — Track 11              │
│  ├── WebGPU compute (client-side correlation) — Track 4          │
│  └── Digital twin simulator — Track 3                            │
│                                                                   │
│  ACCESS                                                           │
│  ├── Desktop dashboard (PWA) — Track 9                           │
│  ├── Public REST API + WebSocket — Track 10                      │
│  ├── Python SDK — Track 10                                       │
│  └── Push notifications — Track 9                                │
│                                                                   │
│  DEPLOYMENT                                                       │
│  ├── VPS (Docker + Nginx + SSL)                                  │
│  ├── GitHub Actions CI/CD                                        │
│  └── Cloudflare CDN                                              │
└─────────────────────────────────────────────────────────────────┘
```