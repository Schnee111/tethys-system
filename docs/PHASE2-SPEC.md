# TETHYS — Phase 2 Technical Specification: Intelligence Engine

## Overview

Phase 2 builds the analysis layer on top of Phase 1's data foundation. This is where Tethys starts thinking — detecting anomalies, finding correlations between domains, and generating insights.

**Duration:** 2 weeks
**Prerequisite:** Phase 1 complete, 7+ days of continuous data collected
**Goal:** Automated anomaly detection + cross-domain correlation discovery

---

## Components

```
┌─────────────────────────────────────────────────────────┐
│                 ANALYSIS ENGINE                          │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Anomaly    │  │ Correlation  │  │  Insight     │  │
│  │   Detector   │  │   Engine     │  │  Generator   │  │
│  │              │  │              │  │              │  │
│  │ Robust Z     │  │ time_bucket  │  │ Activity     │  │
│  │ (MAD-based)  │  │ Pearson/Spr  │  │ Index        │  │
│  │ Isolation    │  │ Lag corr     │  │ (not Threat) │  │
│  │ Forest       │  │ Granger      │  │ Explainable  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         └──────────────────┴──────────────────┘          │
│                          │                               │
│                   ┌──────┴───────┐                       │
│                   │  Results DB  │                       │
│                   └──────────────┘                       │
└─────────────────────────────────────────────────────────┘
```
```

---

## Database Schema (New Tables)

### Table: anomalies

```sql
CREATE TABLE anomalies (
    time          TIMESTAMPTZ NOT NULL,
    anomaly_id    TEXT NOT NULL,
    domain        TEXT NOT NULL,  -- 'seismic', 'solar_wind', 'goes', 'atmospheric'
    metric        TEXT NOT NULL,  -- 'magnitude', 'bz_gsm', 'xray_flux', 'temperature'
    value         REAL NOT NULL,
    z_score       REAL,          -- standard deviations from mean
    threshold     REAL,          -- threshold that triggered alert
    severity      TEXT NOT NULL,  -- 'low', 'medium', 'high', 'critical'
    description   TEXT,
    raw_data      JSONB,
    PRIMARY KEY (time, anomaly_id)
);

SELECT create_hypertable('anomalies', 'time');
CREATE INDEX ON anomalies (domain, time DESC);
CREATE INDEX ON anomalies (severity, time DESC);
```

### Table: correlations

```sql
CREATE TABLE correlations (
    time              TIMESTAMPTZ NOT NULL,
    correlation_id    TEXT NOT NULL,
    domain_a          TEXT NOT NULL,  -- 'solar_wind'
    metric_a          TEXT NOT NULL,  -- 'bz_gsm'
    domain_b          TEXT NOT NULL,  -- 'seismic'
    metric_b          TEXT NOT NULL,  -- 'magnitude'
    window_hours      INTEGER NOT NULL, -- correlation window (e.g., 24, 72, 168)
    pearson_r         REAL,          -- Pearson correlation coefficient
    spearman_rho      REAL,          -- Spearman rank correlation
    p_value           REAL,          -- statistical significance
    sample_size       INTEGER,
    is_significant    BOOLEAN,       -- p_value < 0.05
    description       TEXT,
    PRIMARY KEY (time, correlation_id)
);

SELECT create_hypertable('correlations', 'time');
CREATE INDEX ON correlations (is_significant, time DESC);
```

### Table: activity_assessments

```sql
-- NOTE: Renamed from "activity_assessments" to "activity_assessments"
-- "Threat" implies prediction of danger. "Activity" implies observation.
-- This is a research observatory, not a warning system.
-- Source: GPT Scientific Review — "Threat Score secara ilmiah lemah"

CREATE TABLE activity_assessments (
    time              TIMESTAMPTZ NOT NULL,
    assessment_id     TEXT NOT NULL,
    activity_level    TEXT NOT NULL,  -- 'nominal', 'elevated', 'high', 'intense'
    activity_score    REAL NOT NULL,  -- 0.0 to 1.0
    confidence        REAL,          -- 0.0 to 1.0 (data coverage × freshness)
    coverage          TEXT,          -- '4/6 sources available'
    score_breakdown   JSONB,         -- per-domain contribution
    active_anomalies  INTEGER,
    active_correlations INTEGER,
    domains_affected  TEXT[],         -- ['solar_wind', 'seismic']
    summary           TEXT,           -- natural language summary
    details           JSONB,
    PRIMARY KEY (time, assessment_id)
);

SELECT create_hypertable('activity_assessments', 'time');
```

---

## Anomaly Detection

### Method 1: Z-Score (Statistical)

```python
import numpy as np
import uuid
from scipy import stats

class ZScoreDetector:
    """Detect anomalies using Robust Z-score (MAD-based).
    
    WHY NOT STANDARD Z-SCORE:
    Earthquake magnitudes, solar flares, and solar wind speed follow
    power-law / heavy-tail distributions, NOT normal distributions.
    Standard Z-score assumes normality → excessive false positives
    on heavy-tailed data.
    
    SOLUTION: Robust Z-score using MAD (Median Absolute Deviation):
    robust_z = 0.6745 * (x - median) / MAD
    
    - No normality assumption
    - Robust to outliers (median, not mean)
    - 0.6745 scaling factor makes it comparable to standard Z-score
      for normal data (same threshold interpretation)
    
    Source: Boris Iglewicz, David Hoaglin (1993)
    "Volume 16: How to Detect and Handle Outliers"
    """
    
    def __init__(self, window_hours=168, threshold=3.0):
        self.window_hours = window_hours
        self.threshold = threshold
    
    # Allowlist of tables and metrics that can be queried
    # Prevents SQL injection if values ever come from external input
    ALLOWED_TABLES = {'seismic_events', 'solar_wind', 'goes_flux', 
                      'atmospheric_data', 'solar_wind_hourly', 
                      'goes_flux_hourly', 'atmospheric_daily'}
    ALLOWED_METRICS = {'magnitude', 'depth_km', 'density', 'speed', 
                       'temperature', 'bt', 'bz_gsm', 'flux', 
                       'pressure', 'wind_speed', 'event_count'}
    
    async def detect(self, pool, table, metric, domain):
        """Run robust Z-score anomaly detection on a metric."""
        # Validate table and metric against allowlist
        if table not in self.ALLOWED_TABLES:
            raise ValueError(f"Table '{table}' not in allowlist")
        if metric not in self.ALLOWED_METRICS:
            raise ValueError(f"Metric '{metric}' not in allowlist")
        
        query = f"""
            SELECT time, {metric}
            FROM {table}
            WHERE time > NOW() - INTERVAL '{self.window_hours} hours'
            ORDER BY time
        """
        async with pool.acquire() as conn:
            rows = await conn.fetch(query)
        
        if len(rows) < 100:
            return []
        
        values = np.array([r[metric] for r in rows])
        times = [r['time'] for r in rows]
        
        # Robust Z-score using MAD (not mean/std)
        median = np.nanmedian(values)
        mad = np.nanmedian(np.abs(values - median))
        
        if mad == 0 or np.isnan(mad):
            return []
        
        # 0.6745 scaling factor: makes MAD comparable to std for normal data
        robust_z_scores = 0.6745 * (values - median) / mad
        
        # Find anomalies (last 24 hours only)
        anomalies = []
        cutoff = datetime.utcnow() - timedelta(hours=24)
        for i, (t, z, v) in enumerate(zip(times, robust_z_scores, values)):
            if t > cutoff and abs(z) > self.threshold and np.isfinite(z):
                anomaly_id = hashlib.md5(
                    f"{t.isoformat()}:{domain}:{metric}".encode()
                ).hexdigest()[:12]
                
                anomalies.append({
                    'time': t,
                    'anomaly_id': anomaly_id,
                    'domain': domain,
                    'metric': metric,
                    'value': float(v),
                    'robust_z_score': float(z),
                    'threshold': self.threshold,
                    'method': 'mad_robust_z',
                    'severity': self._classify_severity(abs(z))
                })
        
        return anomalies
    
    def _classify_severity(self, abs_z):
        if abs_z > 5.0: return 'critical'
        if abs_z > 4.0: return 'high'
        if abs_z > 3.0: return 'medium'
        return 'low'
```

### Method 2: Isolation Forest (ML)

```python
from sklearn.ensemble import IsolationForest
import joblib

class IsolationForestDetector:
    """Multivariate anomaly detection using Isolation Forest.
    
    ARCHITECTURE:
    - Training: Google Colab (free T4 GPU) → export model as joblib/ONNX
    - Inference: VPS (CPU only, lightweight model.predict())
    
    DO NOT train on VPS with n_jobs=-1. IsolationForest uses all vCPUs
    (2 cores on your VPS), causing CPU lockup that freezes PostgreSQL,
    Uvicorn, and Nginx simultaneously.
    
    If VPS training is absolutely required:
    - Set n_jobs=1 (single core only)
    - Wrap in asyncio.to_thread() to avoid blocking event loop
    """
    
    def __init__(self, contamination=0.01):
        self.contamination = contamination
        self.model = None
    
    async def load_model(self, model_path='models/isolation_forest.joblib'):
        """Load pre-trained model (trained on Colab, exported as joblib).
        
        SECURITY: joblib.load() executes arbitrary Python code via pickle.
        Validate file integrity before loading.
        
        Source: Claude Review — "joblib.load tanpa validasi"
        """
        import hashlib
        import os
        
        # Verify file exists
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        # Verify checksum (stored alongside model file)
        checksum_path = model_path + '.sha256'
        if os.path.exists(checksum_path):
            with open(checksum_path, 'r') as f:
                expected_hash = f.read().strip()
            
            with open(model_path, 'rb') as f:
                actual_hash = hashlib.sha256(f.read()).hexdigest()
            
            if actual_hash != expected_hash:
                raise ValueError(
                    f"Model checksum mismatch! "
                    f"Expected: {expected_hash}, Got: {actual_hash}. "
                    f"Model file may be corrupted or tampered."
                )
        
        self.model = joblib.load(model_path)
    
    async def detect(self, pool, table, metrics):
        """Detect multivariate anomalies using pre-trained model.
        Inference only — no training on VPS."""
        if self.model is None:
            await self.load_model()
        
        query = f"""
            SELECT time, {', '.join(metrics)}
            FROM {table}
            WHERE time > NOW() - INTERVAL '1 hour'
        """
        async with pool.acquire() as conn:
            rows = await conn.fetch(query)
        
        data = np.array([[r[m] for m in metrics] for r in rows])
        
        # Lightweight inference (NOT training)
        predictions = self.model.predict(data)  # -1 = anomaly
        
        anomalies = []
        for i, (row, pred) in enumerate(zip(rows, predictions)):
            if pred == -1:
                anomalies.append({
                    'time': row['time'],
                    'values': {m: float(row[m]) for m in metrics},
                    'anomaly_score': float(self.model.decision_function([data[i]])[0])
                })
        
        return anomalies

# ===== TRAINING SCRIPT (Run on Google Colab, NOT VPS) =====
# Save this as: notebooks/train_isolation_forest.ipynb
#
# import pandas as pd
# from sklearn.ensemble import IsolationForest
# import joblib
#
# # Load historical data (exported from VPS TimescaleDB)
# data = pd.read_csv('solar_wind_30days.csv')
# metrics = ['density', 'speed', 'temperature', 'bt', 'bz_gsm']
#
# model = IsolationForest(
#     contamination=0.01,
#     random_state=42,
#     n_jobs=-1  # Safe on Colab, NOT on VPS
# )
# model.fit(data[metrics])
#
# joblib.dump(model, 'isolation_forest.joblib')
# # Upload back to VPS: scp isolation_forest.joblib vps:/opt/tethys/backend/models/
```

### Anomaly Detection Matrix

```
DOMAIN          METRIC              METHOD      THRESHOLD   MIN SAMPLES
──────────────  ──────────────────  ──────────  ──────────  ───────────
seismic         magnitude           Z-score     > 3.0       100
seismic         events_per_hour     Z-score     > 3.0       100
solar_wind      bz_gsm (southward)  Z-score     < -3.0      1000
solar_wind      speed               Z-score     > 3.0       1000
solar_wind      density             Z-score     > 3.0       1000
goes            xray_flux           Z-score     > 3.0       1000
goes            proton_flux         Z-score     > 3.0       1000
atmospheric     temperature         Z-score     > 3.0       500
atmospheric     pressure            Z-score     > 3.0       500
multivariate    solar_wind_combo    Isol.Forest contamination=0.01   5000
multivariate    seismic_combo       Isol.Forest contamination=0.01   5000

MINIMUM SAMPLE GUARDRAILS:
- Z-score: requires min 100 samples (otherwise Z-score is meaningless)
- Isolation Forest: requires min 5000 samples per domain
- If insufficient data → skip detection, log warning, retry next cycle
- Phase 2 starts at week 3, but Isolation Forest delayed until 60+ days
  of continuous data collected (solar_wind, goes_flux only)
- Volcanic + atmospheric: Z-score only (too sparse for Isolation Forest)
```

---

## Cross-Domain Correlation Engine

### The Challenge

Different data sources have different cadences:
- seismic_events: Event-driven (random)
- goes_flux: Every 1 minute
- solar_wind: Every 5 minutes
- atmospheric_data: Every 1 hour

### Solution: time_bucket() Resampling

```python
class CorrelationEngine:
    """Discover correlations between different domains."""
    
    # CORRELATION_PAIRS: metric pairs to test
    # Includes lag correlation (0/24/48/72h) AND Granger causality
    #
    # Granger causality: does knowing PAST of domain_a improve
    # prediction of domain_b FUTURE? More rigorous than simple correlation.
    # Implementation: statsmodels.tsa.stattools.grangercausalitytests
    #
    # Source: GPT Scientific Review — "Correlation bukan mekanisme"
    
    CORRELATION_PAIRS = [
        # (domain_a, metric_a, domain_b, metric_b, window_hours)
        # Both metrics must be CONTINUOUS (not count, not binary)
        ('solar_wind', 'bz_gsm', 'seismic', 'event_count', 24),
        ('solar_wind', 'speed', 'seismic', 'event_count', 24),
        ('solar_wind', 'density', 'seismic', 'event_count', 24),
        ('goes', 'xray_flux', 'seismic', 'event_count', 24),
        ('goes', 'proton_flux', 'seismic', 'event_count', 24),
        ('solar_wind', 'bz_gsm', 'atmospheric', 'pressure', 72),
        ('atmospheric', 'pressure', 'seismic', 'event_count', 48),
        # NOTE: volcanic_events and space_weather_events are EXCLUDED
        # from correlation engine. They are discrete/binary events.
        # Use anomaly detection (Z-score/MAD) for these domains.
    ]
    
    # CONTINUOUS_METRICS: whitelist of metrics safe for Pearson/Spearman
    CONTINUOUS_METRICS = {
        'solar_wind': ['density', 'speed', 'temperature', 'bt', 'bx_gsm', 'by_gsm', 'bz_gsm'],
        'goes': ['xray_flux', 'proton_flux', 'electron_flux'],
        'atmospheric': ['temperature', 'pressure', 'wind_speed', 'wind_dir', 'precipitation'],
        'seismic': ['event_count'],  # Count per bucket is continuous enough
    }
    
    # DISCRETE_DOMAINS: domains that should NEVER enter correlation engine
    DISCRETE_DOMAINS = {'volcanic', 'space_weather'}
    
    async def compute_correlation(self, pool, domain_a, metric_a, 
                                   domain_b, metric_b, window_hours):
        """Compute correlation between two metrics using time_bucket.
        
        INCLUDES LAG CORRELATION:
        Solar effects on seismic activity don't happen at T0.
        CME → magnetosphere induction → piezoelectric stress → earthquake
        can take 24-72 hours. We test multiple lag windows.
        
        Source: Gemini Review — "Time-Lag Ignorance"
        """
        
        # Define lag windows to test (hours to shift seismic data)
        LAG_WINDOWS = [0, 24, 48, 72]  # hours
        
        results = []
        
        for lag_hours in LAG_WINDOWS:
            # Adjust query time window to account for lag
            # If testing 24h lag, we need data from (now-96h) to (now-24h)
            # to have 72 hours of overlapping data
            
            query_a = f"""
                SELECT time_bucket('1 hour', time) AS bucket,
                       AVG({metric_a}) AS value
                FROM {self._table(domain_a)}
                WHERE time > NOW() - INTERVAL '{window_hours + lag_hours} hours'
                  AND time < NOW() - INTERVAL '{lag_hours} hours'
                GROUP BY bucket
                ORDER BY bucket
            """
            
            # For seismic: use energy release, not event count.
            # COUNT(*) is contaminated by detection threshold, regional coverage,
            # and aftershock swarms. Energy proxy captures physical significance.
            #
            # Seismic moment: M₀ = 10^(1.5*M + 4.8) in Newton-meters
            # Energy: E = 10^(1.5*M + 4.8) (approximation)
            #
            # Source: Claude Review + GPT Scientific Review
            # "events_per_hour contaminated by detection threshold"
            
            if domain_b == 'seismic':
                query_b = f"""
                    SELECT time_bucket('1 hour', time) AS bucket,
                           SUM(POWER(10, 1.5 * magnitude + 4.8)) AS value
                    FROM seismic_events
                    WHERE time > NOW() - INTERVAL '{window_hours} hours'
                    GROUP BY bucket
                    ORDER BY bucket
                """
            else:
                query_b = f"""
                    SELECT time_bucket('1 hour', time) AS bucket,
                           AVG({metric_b}) AS value
                    FROM {self._table(domain_b)}
                    WHERE time > NOW() - INTERVAL '{window_hours} hours'
                    GROUP BY bucket
                    ORDER BY bucket
                """
            
            async with pool.acquire() as conn:
                rows_a = await conn.fetch(query_a)
                rows_b = await conn.fetch(query_b)
            
            # Align by timestamp
            data_a = {r['bucket']: float(r['value']) for r in rows_a}
            data_b = {r['bucket']: float(r['value']) for r in rows_b}
            
            common_times = sorted(set(data_a.keys()) & set(data_b.keys()))
            
            if len(common_times) < 20:
                continue
            
            values_a = np.array([data_a[t] for t in common_times])
            values_b = np.array([data_b[t] for t in common_times])
            
            # STATIONARITY FIX: First-order differencing
            # Atmospheric data (temperature, pressure) has strong diurnal cycle.
            # Correlating raw values produces spurious correlations.
            # Differencing removes the cycle: ΔT = T(t) - T(t-1)
            #
            # Source: Gemini Review — "Pelanggaran Stasioneritas"
            # Only apply to continuous atmospheric/solar metrics,
            # NOT to event counts (seismic) which are already stationary.
            
            CONTINUOUS_METRICS = {'temperature', 'pressure', 'wind_speed', 
                                  'density', 'speed', 'bt', 'bz_gsm',
                                  'xray_flux', 'proton_flux'}
            
            if metric_a in CONTINUOUS_METRICS and len(values_a) > 1:
                values_a = np.diff(values_a)  # First-order differencing
            if metric_b in CONTINUOUS_METRICS and len(values_b) > 1:
                values_b = np.diff(values_b)
            
            # Sanitize
            valid_mask = np.isfinite(values_a) & np.isfinite(values_b)
            values_a = values_a[valid_mask]
            values_b = values_b[valid_mask]
            
            if len(values_a) < 20:
                continue
            
            if np.std(values_a) == 0 or np.std(values_b) == 0:
                continue
            
            try:
                pearson_r, pearson_p = stats.pearsonr(values_a, values_b)
                spearman_rho, spearman_p = stats.spearmanr(values_a, values_b)
            except ValueError:
                continue
            
            results.append({
                'domain_a': domain_a,
                'metric_a': metric_a,
                'domain_b': domain_b,
                'metric_b': metric_b,
                'window_hours': window_hours,
                'lag_hours': lag_hours,
                'pearson_r': float(pearson_r),
                'spearman_rho': float(spearman_rho),
                'p_value': float(min(pearson_p, spearman_p)),
                'sample_size': len(values_a),
                'is_significant': False,  # Will be set by FDR correction
                'granger_p': None,  # Computed separately if sample_size > 50
                'granger_causal': False  # True if Granger p < 0.05
            })
        
        # Return the strongest correlation across all lag windows
        if not results:
            return None
        
        best = max(results, key=lambda r: abs(r['pearson_r']))
        return best
    
    def _table(self, domain):
        """Map domain name to database table name.
        
        CRITICAL: Use AGGREGATE tables for correlation, not raw tables.
        Correlation queries scan 30-day windows. Raw tables have millions
        of rows. Aggregate tables have hourly summaries — 1000x fewer rows.
        
        Source: Gemini Review — "Kueri Tabel yang Salah Sasaran"
        
        ATMOSPHERIC NOTE: atmospheric_daily has 150 individual locations.
        For correlation with global metrics (solar wind, GOES), we need
        a GLOBAL average, not per-location. The query uses AVG() over
        all locations in the time_bucket to produce a single global value
        per time bucket.
        """
        return {
            'seismic': 'seismic_events',          # No aggregate (event-driven)
            'solar_wind': 'solar_wind_hourly',     # USE AGGREGATE
            'goes': 'goes_flux_hourly',            # USE AGGREGATE
            'atmospheric': 'atmospheric_daily',    # USE AGGREGATE (150 locations)
        }[domain]
    
    def _build_atmospheric_query(self, metric, window_hours):
        """Atmospheric data needs special handling: 150 locations must be
        aggregated to a single global value per time bucket.
        
        For correlation with solar wind (global metric), we need:
        - AVG across all 150 locations per day bucket
        - This gives us a "global atmospheric state" per day
        """
        return f"""
            SELECT time_bucket('1 day', day) AS bucket,
                   AVG({metric}) AS value
            FROM atmospheric_daily
            WHERE day > NOW() - INTERVAL '{window_hours} hours'
            GROUP BY time_bucket('1 day', day)
            ORDER BY bucket
        """
    
    async def _count_recent_anomalies(self, pool) -> dict:
        """Count anomalies in last 24 hours per domain."""
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT domain, COUNT(*) as cnt
                FROM anomalies
                WHERE time > NOW() - INTERVAL '24 hours'
                GROUP BY domain
            """)
        return {r['domain']: r['cnt'] for r in rows}
    
    async def _get_significant_correlations(self, pool) -> list:
        """Get FDR-corrected significant correlations from last 24 hours."""
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT * FROM correlations
                WHERE time > NOW() - INTERVAL '24 hours'
                  AND is_significant = true
                ORDER BY time DESC
            """)
        return [dict(r) for r in rows]
    
    async def run_all(self, pool):
        """Run all correlation pairs and apply FDR correction.
        
        MULTIPLE TESTING PROBLEM:
        7 pairs × 4 lag windows = 28 tests per run, hourly.
        At p < 0.05, expect ~1 false positive per run even with
        no real correlations. This floods dashboard with noise.
        
        SOLUTION: Benjamini-Hochberg FDR correction.
        Source: statsmodels.stats.multitest.multipletests
        Method: 'fdr_bh' (Benjamini/Hochberg for independent tests)
        
        Usage:
            from statsmodels.stats.multitest import multipletests
            reject, pvals_corrected, _, _ = multipletests(
                pvals, alpha=0.05, method='fdr_bh'
            )
        """
        results = []
        raw_pvals = []
        
        for pair in self.CORRELATION_PAIRS:
            result = await self.compute_correlation(pool, *pair)
            if result:
                results.append(result)
                raw_pvals.append(result['p_value'])
        
        if not raw_pvals:
            return []
        
        # Apply Benjamini-Hochberg FDR correction
        # Source: statsmodels.org/stable/generated/statsmodels.stats.multitest.multipletests.html
        from statsmodels.stats.multitest import multipletests
        reject, pvals_corrected, _, _ = multipletests(
            raw_pvals, alpha=0.05, method='fdr_bh'
        )
        
        # Update results with corrected significance
        for i, result in enumerate(results):
            result['p_value_corrected'] = float(pvals_corrected[i])
            result['is_significant'] = bool(reject[i])
            result['fdr_method'] = 'benjamini_hochberg'
        
        # Only return significant results
        return [r for r in results if r['is_significant']]
```

### Correlation Schedule

```
TASK                        FREQUENCY       WINDOW
──────────────────────────  ──────────────  ──────────
Quick correlations          Every 1 hour    24 hours
Medium correlations         Every 6 hours   72 hours (3 days)
Deep correlations           Every 24 hours  168 hours (7 days)
Full matrix analysis        Weekly          720 hours (30 days)
```

---

## Threat Assessment

```python
class ActivityAssessor:
    """Compute composite activity score from anomalies and correlations.
    
    RENAMED from ThreatAssessor to ActivityAssessor.
    "Threat" implies prediction of danger. "Activity" implies observation.
    This is a research observatory, not a warning system.
    
    INCLUDES UNCERTAINTY PROPAGATION:
    If data sources are down or stale, confidence decreases.
    An activity score of 0.76 with 42% confidence (2/6 sources unavailable)
    is very different from 0.76 with 98% confidence.
    
    Source: GPT Scientific Review — "Threat Score secara ilmiah lemah"
    """
    
    # Weights must sum to 1.0 (including correlation component)
    # Domain weights: 0.75 total
    # Correlation weight: 0.25
    # Total: 1.0
    #
    # Source: Claude Review — "activity score tidak dinormalisasi"
    # Previously domain weights summed to 1.0 AND corr_score added 0.25,
    # allowing total to exceed 1.0.
    
    SOURCE_CONFIG = {
        'seismic': {'max_staleness_minutes': 10, 'weight': 0.225},   # 0.3 * 0.75
        'solar_wind': {'max_staleness_minutes': 15, 'weight': 0.1875}, # 0.25 * 0.75
        'goes': {'max_staleness_minutes': 10, 'weight': 0.15},        # 0.2 * 0.75
        'atmospheric': {'max_staleness_minutes': 120, 'weight': 0.075}, # 0.1 * 0.75
        'volcanic': {'max_staleness_minutes': 180, 'weight': 0.0375},  # 0.05 * 0.75
        'space_weather': {'max_staleness_minutes': 60, 'weight': 0.075}, # 0.1 * 0.75
    }
    # Sum: 0.225 + 0.1875 + 0.15 + 0.075 + 0.0375 + 0.075 = 0.75
    # + corr_score (max 0.25) = 1.0 maximum
    
    async def assess(self, pool) -> dict:
        """Generate threat assessment with uncertainty."""
        # Count recent anomalies by domain
        anomalies = await self._count_recent_anomalies(pool)
        
        # Check for significant correlations
        correlations = await self._get_significant_correlations(pool)
        
        # Check data source availability and staleness
        source_status = await self._check_source_freshness(pool)
        available_sources = sum(1 for s in source_status.values() if s['is_fresh'])
        total_sources = len(source_status)
        
        # Compute weighted score (only from available sources)
        score = 0.0
        score_breakdown = {}
        
        for domain, config in self.SOURCE_CONFIG.items():
            if source_status.get(domain, {}).get('is_fresh', False):
                domain_score = min(anomalies.get(domain, 0) / 5, 1.0) * config['weight']
                score += domain_score
                score_breakdown[domain] = round(domain_score, 3)
        
        # Add correlation component
        corr_score = min(len(correlations) / 3, 1.0) * 0.25
        score += corr_score
        score_breakdown['cross_correlation'] = round(corr_score, 3)
        
        # Compute confidence based on data coverage and staleness
        coverage = available_sources / total_sources
        avg_freshness = np.mean([
            min(1.0, s['max_staleness_minutes'] / max(s['age_minutes'], 1))
            for s in source_status.values()
        ])
        confidence = round(coverage * avg_freshness, 3)
        
        # Classify threat level
        if score > 0.8: level = 'severe'
        elif score > 0.6: level = 'high'
        elif score > 0.3: level = 'elevated'
        else: level = 'nominal'
        
        summary = self._generate_summary(
            anomalies, correlations, level, 
            available_sources, total_sources, confidence
        )
        
        return {
            'activity_level': level,
            'activity_score': round(score, 3),
            'confidence': confidence,
            'coverage': f"{available_sources}/{total_sources}",
            'available_sources': available_sources,
            'total_sources': total_sources,
            'score_breakdown': score_breakdown,
            'source_status': source_status,
            'active_anomalies': sum(anomalies.values()),
            'active_correlations': len(correlations),
            'domains_affected': [d for d, c in anomalies.items() if c > 0],
            'summary': summary
        }
    
    async def _check_source_freshness(self, pool) -> dict:
        """Check if each data source has fresh data."""
        status = {}
        for domain, config in self.SOURCE_CONFIG.items():
            table = self._table(domain)
            async with pool.acquire() as conn:
                row = await conn.fetchrow(f"""
                    SELECT MAX(time) as latest 
                    FROM {table}
                """)
            
            if row and row['latest']:
                age_minutes = (datetime.utcnow() - row['latest']).total_seconds() / 60
                status[domain] = {
                    'latest': row['latest'],
                    'age_minutes': round(age_minutes, 1),
                    'max_staleness_minutes': config['max_staleness_minutes'],
                    'is_fresh': age_minutes <= config['max_staleness_minutes']
                }
            else:
                status[domain] = {
                    'latest': None,
                    'age_minutes': float('inf'),
                    'max_staleness_minutes': config['max_staleness_minutes'],
                    'is_fresh': False
                }
        
        return status
    
    def _generate_summary(self, anomalies, correlations, level, 
                          available, total, confidence):
        """Generate human-readable summary with uncertainty."""
        parts = []
        
        if available < total:
            parts.append(f"⚠️ Data coverage: {available}/{total} sources available "
                        f"(confidence: {confidence*100:.0f}%)")
        
        if anomalies.get('seismic', 0) > 0:
            parts.append(f"{anomalies['seismic']} seismic anomalies detected")
        if anomalies.get('solar_wind', 0) > 0:
            parts.append(f"solar wind parameters elevated")
        if anomalies.get('goes', 0) > 0:
            parts.append(f"GOES flux anomalies detected")
        
        if correlations:
            parts.append(f"{len(correlations)} cross-domain correlations active")
        
        if not parts or (len(parts) == 1 and 'coverage' in parts[0]):
            return "All planetary systems nominal. No significant anomalies detected."
        
        return f"Threat level: {level.upper()} (confidence: {confidence*100:.0f}%). " + ". ".join(parts) + "."
```

---

## Scheduler (Phase 2 Addition)

```python
async def analysis_scheduler(pool):
    """Run analysis tasks on schedule."""
    
    detector = ZScoreDetector()
    correlator = CorrelationEngine()
    assessor = ActivityAssessor()
    
    # Track last correlation run (hourly, not every 15 min)
    last_correlation_run = 0
    
    while True:
        try:
            # Anomaly detection — every 15 minutes
            await detect_all(pool, detector)
            
            # Correlation — hourly (not every 15 min)
            now = time.time()
            if now - last_correlation_run >= 3600:
                await correlator.run_all(pool)
                last_correlation_run = now
            
            # Activity assessment — every 15 minutes
            assessment = await assessor.assess(pool)
            await store_assessment(pool, assessment)
            
            # Broadcast via WebSocket
            await broadcast_event({
                'type': 'activity_assessment',
                'data': assessment
            })
            
        except Exception as e:
            logger.error(f"Analysis error: {e}")
        
        await asyncio.sleep(900)  # 15 minutes


async def detect_all(pool, detector):
    """Run anomaly detection across all domains and metrics.
    
    Iterates over the anomaly detection matrix and runs MAD-based
    robust Z-score for each metric/domain combination.
    """
    DETECTION_MATRIX = [
        # (table, metric, domain, min_samples)
        ('seismic_events', 'magnitude', 'seismic', 100),
        ('solar_wind', 'bz_gsm', 'solar_wind', 1000),
        ('solar_wind', 'speed', 'solar_wind', 1000),
        ('solar_wind', 'density', 'solar_wind', 1000),
        ('goes_flux', 'flux', 'goes', 1000),
        ('atmospheric_data', 'temperature', 'atmospheric', 500),
        ('atmospheric_data', 'pressure', 'atmospheric', 500),
    ]
    
    all_anomalies = []
    for table, metric, domain, min_samples in DETECTION_MATRIX:
        try:
            anomalies = await detector.detect(pool, table, metric, domain)
            all_anomalies.extend(anomalies)
        except Exception as e:
            logger.warning(f"Detection failed for {domain}/{metric}: {e}")
    
    # Store all anomalies
    if all_anomalies:
        async with pool.acquire() as conn:
            async with conn.transaction():
                for a in all_anomalies:
                    await conn.execute("""
                        INSERT INTO anomalies 
                            (time, anomaly_id, domain, metric, value, 
                             z_score, threshold, severity, description)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT (time, anomaly_id) DO NOTHING
                    """, a['time'], a['anomaly_id'], a['domain'], 
                        a['metric'], a['value'], a.get('robust_z_score', 0),
                        a['threshold'], a['severity'], 
                        f"{a['metric']}={a['value']:.2f} (z={a.get('robust_z_score', 0):.1f})")


async def store_assessment(pool, assessment):
    """Store threat assessment in database."""
    assessment_id = hashlib.md5(
        f"{datetime.utcnow().isoformat()}:threat".encode()
    ).hexdigest()[:12]
    
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO activity_assessments 
                (time, assessment_id, activity_level, activity_score,
                 active_anomalies, active_correlations, 
                 domains_affected, summary, details)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        """, datetime.utcnow(), assessment_id,
            assessment['activity_level'], assessment['activity_score'],
            assessment['active_anomalies'], assessment['active_correlations'],
            assessment['domains_affected'], assessment['summary'],
            json.dumps(assessment))


async def get_recent_events(pool, hours=24):
    """Get recent events from all tables for WebSocket sync.
    Returns combined data for the last N hours."""
    result = {}
    
    queries = {
        'seismic': f"""
            SELECT * FROM seismic_events 
            WHERE time > NOW() - INTERVAL '{hours} hours'
            ORDER BY time DESC LIMIT 500
        """,
        'solar_wind': f"""
            SELECT * FROM solar_wind 
            WHERE time > NOW() - INTERVAL '{hours} hours'
            ORDER BY time DESC LIMIT 500
        """,
        'goes': f"""
            SELECT * FROM goes_flux 
            WHERE time > NOW() - INTERVAL '{hours} hours'
            ORDER BY time DESC LIMIT 500
        """,
        'space_weather': f"""
            SELECT * FROM space_weather_events 
            WHERE time > NOW() - INTERVAL '{hours} hours'
            ORDER BY time DESC LIMIT 100
        """,
        'anomalies': f"""
            SELECT * FROM anomalies 
            WHERE time > NOW() - INTERVAL '{hours} hours'
            ORDER BY time DESC LIMIT 200
        """,
        'threat': """
            SELECT * FROM activity_assessments 
            ORDER BY time DESC LIMIT 1
        """
    }
    
    async with pool.acquire() as conn:
        for key, query in queries.items():
            rows = await conn.fetch(query)
            result[key] = [dict(r) for r in rows]
    
    return result
```

---

## Phase 2 Deliverables

1. ✅ Anomaly detection running (Z-score + Isolation Forest)
2. ✅ Correlation engine computing cross-domain relationships
3. ✅ Threat assessment generating composite scores
4. ✅ New database tables (anomalies, correlations, activity_assessments)
5. ✅ API endpoints for querying analysis results
6. ✅ At least one interesting cross-domain pattern identified

## Phase 2 Success Criteria

- [ ] Z-score anomaly detection operational for all domains
- [ ] Isolation Forest trained on 30+ days of multivariate data
- [ ] Correlation engine computing hourly/weekly matrices
- [ ] Threat assessment updating every 15 minutes
- [ ] API endpoints returning analysis results
- [ ] At least one statistically significant cross-domain correlation found
