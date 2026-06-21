# TETHYS — Scientific Methods & Research Basis

## Overview

Tethys is a **research observatory**, not a prediction system. It observes
correlations in planetary data across multiple domains — seismic, solar wind,
GOES X-ray flux, atmospheric, volcanic, and space weather.

**This document describes the scientific methods, their validity, limitations,
and the peer-reviewed research that supports them.**

---

## 1. Anomaly Detection: MAD-Based Robust Z-Score

### Method

Standard Z-score assumes normally distributed data. Earthquake magnitudes,
solar flares, and solar wind speed follow **power-law / heavy-tail
distributions**, NOT normal. Standard Z-score → excessive false positives.

**Solution: Robust Z-score using MAD (Median Absolute Deviation)**

```
robust_z = 0.6745 * (x - median) / MAD
where MAD = median(|x - median|)
```

- 0.6745 scaling factor makes MAD comparable to standard deviation for normal data
- Median (not mean) is robust to outliers
- No normality assumption required

### Thresholds

| |z| > 3.0 | Medium severity — statistical outlier |
| |z| > 4.0 | High severity — unusual event |
| |z| > 5.0 | Critical severity — extreme event |

### Scientific Basis

- **Iglewicz & Hoaglin (1993)** — "Volume 16: How to Detect and Handle Outliers"
  — Establishes MAD as standard robust outlier detection method
- **Leys et al. (2013)** — "Detecting outliers: Do not use standard deviation
  around the mean, use absolute deviation around the median"
  — Journal of Experimental Social Psychology

### Limitations

- MAD assumes symmetric distribution (may miss asymmetric outliers)
- Threshold 3.0 is conventional, not physically derived
- Does not capture temporal patterns (rising trends, periodic spikes)
- Single-metric only — cannot detect multivariate anomalies

### Planned Improvements

- **Isolation Forest** (Priority 2) — multivariate anomaly detection
- **DBSCAN** — density-based clustering for spatial anomaly patterns

---

## 2. Cross-Domain Correlation

### Method

Tests if two metrics from different domains co-vary, with time lag testing.

**Correlation metrics:**
- **Pearson r** — linear correlation coefficient
- **Spearman ρ** — rank correlation (robust to non-linearity)

**Lag windows tested:** [0, 6, 12, 24, 48, 72, 120, 168] hours

**Minimum effect size:** |r| > 0.1 (prevents physically meaningless correlations)

**Stationarity fix:** First-order differencing (ΔT = T(t) - T(t-1)) removes
diurnal cycles that cause spurious correlations.

**Seismic energy proxy:** Uses Σ10^(1.5M + 4.8) instead of event count.
Event count is contaminated by detection threshold and aftershock swarms.

### FDR Correction: Benjamini-Yekutieli

**Problem:** 7 pairs × 8 lag windows = 56 tests per run. At p < 0.05,
expect ~3 false positives per run even with no real correlations.

**Solution:** Benjamini-Yekutieli (BY) correction — valid under **arbitrary
dependence structure**. Our lag-correlated tests violate BH's independence
assumption.

**Source:** Benjamini & Yekutieli (2001) — "The control of the false
discovery rate in multiple testing under dependency"

### Granger Causality

Tests if **past values of A improve prediction of B** beyond B's own past.
More rigorous than simple lag correlation — establishes directionality.

```
H₀: Past of A does NOT improve prediction of B
H₁: Past of A DOES improve prediction of B
```

Uses F-test from `statsmodels.tsa.stattools.grangercausalitytests`.
Runs when sample_size > 50.

**Limitation:** Assumes LINEAR relationships. Solar wind forcing may be
nonlinear → Transfer Entropy would be better (see Section 4).

### Scientific Basis

- **Marchitelli et al. (2020)** — Nature Scientific Reports
  "On the correlation between solar activity and large earthquakes"
  — Found M>5.5 earthquakes correlate with proton density, ~1 day lag

- **Subramanian & Rahman (2025)** — Results in Earth Sciences
  "The Influence of Geomagnetic Storms on Global Main Shock Earthquake Occurrence"
  — Found CME → M>5 earthquakes, 1-3 day lag

- **Altaibek et al. (2024)** — Atmosphere
  "Classifying seismic events linked to solar activity: LSTM approach"
  — LSTM model using proton density predicts seismic activity with 1-2 day lag

- **Jarmołowski et al. (2025)** — Advances in Space Research
  "Eight-year global look at correlations between TEC, earthquakes and solar wind"
  — Confirms solar wind → ionosphere → seismic pathway

- **Sun et al. (2024)** — Remote Sensing
  "Statistical analysis of correlation between geomagnetic storm intensity
  and solar wind parameters 1996-2023"
  — Confirms IMF Bs and Ey correlate with storm intensity

### Lag Windows — Physical Basis

| Lag | Physical Mechanism |
|-----|-------------------|
| 0-6h | Direct solar wind pressure on magnetosphere |
| 6-12h | Magnetosphere → ionosphere coupling |
| 24h | Diurnal cycle alignment |
| 48-72h | Storm recovery phase effects |
| 120-168h | Extended geomagnetic storm recovery |

### Limitations

- Correlation ≠ Causation (even with Granger)
- Lag windows are conventional, not derived from first principles
- Global correlation may miss regional signals (spatial dilution)
- Atmospheric diurnal cycle requires differencing

---

## 3. Activity Index

### Method

Composite score (0.0-1.0) from all domains, weighted by domain importance.

**Weights (sum = 1.0):**

| Domain | Weight | Rationale |
|--------|--------|-----------|
| Seismic | 0.225 | Most direct physical impact |
| Solar Wind | 0.1875 | Primary driver of space weather |
| GOES X-ray | 0.15 | Solar flare indicator |
| Atmospheric | 0.075 | Indirect, long-term |
| Volcanic | 0.0375 | Event-driven, sparse |
| Space Weather | 0.075 | Event-driven |
| Cross-correlation | 0.25 | Multi-domain convergence |

**Confidence propagation:** If data sources are stale, confidence decreases.
Score 0.76 with 42% confidence ≠ 0.76 with 98% confidence.

### Activity Levels

| Score | Level | Interpretation |
|-------|-------|---------------|
| 0.0-0.3 | Nominal | All systems within normal range |
| 0.3-0.6 | Elevated | Some anomalies detected |
| 0.6-0.6 | High | Multiple domains showing anomalies |
| 0.8-1.0 | Intense | Cascading anomalies across domains |

### Scientific Basis

- Similar to NOAA Space Weather Scale (G1-G5) — weighted composite
- Similar to USGS PAGER alert system — multi-factor assessment
- NOT a prediction system — observation only

### Limitations

- Weights are initial estimates, need calibration over 90+ days
- No Bayesian updating (Priority 3)
- No historical event calibration

---

## 4. Planned Improvements (Priority 2 & 3)

### Priority 2 — Medium Effort

**Transfer Entropy**
- Information-theoretic analog of Granger causality
- Captures NONLINEAR relationships (critical for solar-seismic)
- No linearity assumption
- Source: Schreiber (2000) — "Measuring information transfer"
- Library: PyInform (Python)

**Wavelet Coherence**
- Time-frequency resolved correlation
- Shows if correlation exists at specific periodicities (diurnal, 27-day, annual)
- Addresses non-stationarity more elegantly than differencing
- Library: pycwt (Python)

**Kp/Dst Index Integration**
- Kp index: standard geomagnetic activity measure (0-9 scale)
- Dst index: ring current strength (storm intensity)
- Available from NOAA SWPC
- Better proxy for geomagnetic activity than raw solar wind parameters

**Prewhitening with ARIMA**
- Fit ARIMA to one series, correlate residuals with other
- Removes autocorrelation-induced spurious cross-correlation
- More rigorous than simple differencing

### Priority 3 — Research Depth

**Phase-Randomized Surrogates**
- Generate 1000 surrogates preserving autocorrelation but destroying cross-series relationships
- Compare observed statistic to null distribution
- More robust than parametric significance tests

**Bayesian Activity Framework**
- Prior: historical base rates
- Evidence: current anomalies and correlations
- Posterior: updated activity probability
- Source: Gelman et al. (2013) — "Bayesian Data Analysis"

**LSTM Prediction Model**
- Based on Altaibek et al. (2024) approach
- Train on solar wind → seismic energy release
- NOT for prediction — for pattern recognition
- Google Colab (free T4 GPU) → export as ONNX

**Event Replay System**
- Replay Carrington (1859), Tonga (2022), Turkey (2023), Tohoku (2011)
- Higher research value than AI narrative
- Demonstrates cross-domain cascade patterns

---

## 5. Data Sources & Quality

| Source | Latency | Coverage | Quality |
|--------|---------|----------|---------|
| USGS Seismic | 2-5 min | Global | High — authoritative |
| NOAA Solar Wind | 5 min | L1 point | High — DSCOVR satellite |
| GOES X-ray | 1-5 min | Geostationary | High — NOAA operational |
| NASA DONKI | 15-40 min | Solar | High — NASA CCMC |
| Open-Meteo | 15-30 min | 150 points | Medium — model reanalysis |
| NASA EONET | 1-24 hours | Event-driven | High — multi-source aggregation |

### Watermark System

Different sources have different latencies. Correlating data with different
ages introduces bias. Each source has a "watermark" = latest reliable timestamp.

```python
SOURCE_WATERMARKS = {
    'seismic': 10 min,
    'solar_wind': 15 min,
    'goes': 10 min,
    'space_weather': 60 min,
    'atmospheric': 120 min,
    'volcanic': 180 min,
}
```

---

## 6. References

### Peer-Reviewed Papers

1. Marchitelli et al. (2020). "On the correlation between solar activity
   and large earthquakes." *Nature Scientific Reports*, 10, 8237.

2. Subramanian & Rahman (2025). "The Influence of Geomagnetic Storms on
   Global Main Shock Earthquake Occurrence." *Results in Earth Sciences*.

3. Altaibek et al. (2024). "Classifying seismic events linked to solar
   activity: A retrospective LSTM approach using proton density."
   *Atmosphere*, 15(11), 1290.

4. Jarmołowski et al. (2025). "An eight-year global look at correlations
   between total electron content, earthquakes and solar wind."
   *Advances in Space Research*.

5. Sun et al. (2024). "Statistical analysis of the correlation between
   geomagnetic storm intensity and solar wind parameters from 1996 to 2023."
   *Remote Sensing*, 16(16), 2952.

6. Benjamini & Yekutieli (2001). "The control of the false discovery rate
   in multiple testing under dependency." *Annals of Statistics*, 29(4).

7. Iglewicz & Hoaglin (1993). "Volume 16: How to Detect and Handle Outliers."
   ASQC Quality Press.

8. Schreiber (2000). "Measuring information transfer." *Physical Review
   Letters*, 85(2).

9. Kanamori (1977). "The energy release in great earthquakes." *Journal of
   Geophysical Research*, 82(20).

### API Documentation

- USGS: https://earthquake.usgs.gov/earthquakes/feed/v1.0/
- NOAA SWPC: https://services.swpc.noaa.gov/
- NASA DONKI: https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/
- Open-Meteo: https://open-meteo.com/en/docs
- NASA EONET: https://eonet.gsfc.nasa.gov/api/v3

---

## 7. Scientific Disclaimer

**Tethys is a research tool, NOT a prediction system.**

- Correlation ≠ Causation
- Z-score anomalies indicate statistical outliers, not warnings
- The "Lament Detector" is a narrative framework, not a scientific claim
- Solar-seismic correlation research is ongoing and controversial
- USGS position: "It has never been demonstrated that there is a causal
  relationship between space weather and earthquakes"

If you use this system or its data, you are responsible for your own
interpretation. Do not use Tethys data to make safety decisions.
