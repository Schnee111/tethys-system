"""Tethys — Cross-Domain Correlation Engine.

Discovers correlations between different planetary data streams.
Uses Pearson + Spearman correlation with time lag testing,
Granger causality for directional inference, and
Benjamini-Yekutieli FDR correction for multiple testing.

Scientific basis:
- Marchitelli et al. (2020) Nature Sci Reports: solar proton density → M>5 earthquakes, ~1 day lag
- Subramanian & Rahman (2025) Results in Earth Sciences: CME → M>5 earthquakes, 1-3 day lag
- Altaibek et al. (2024) Atmosphere: LSTM with proton density predicts seismic activity
- Huzaimy & Yumoto (2011): solar wind & seismic activity, 0-7 day lags
"""

import hashlib
import logging
from datetime import UTC, datetime

import asyncpg
import numpy as np
from scipy import stats

logger = logging.getLogger(__name__)

# Correlation pairs: (domain_a, metric_a, domain_b, metric_b, window_hours)
CORRELATION_PAIRS = [
    ("solar_wind", "avg_bz_gsm", "seismic", "event_count", 24),
    ("solar_wind", "avg_speed", "seismic", "event_count", 24),
    ("solar_wind", "avg_density", "seismic", "event_count", 24),
    ("goes", "avg_flux", "seismic", "event_count", 24),
    ("solar_wind", "avg_bz_gsm", "atmospheric", "avg_temp", 72),
    ("atmospheric", "avg_temp", "seismic", "event_count", 48),
]

# Lag windows to test (hours)
# Based on literature:
# - Solar wind pressure: 0-48h (direct magnetosphere coupling)
# - Geomagnetic storms: 1-7 days (storm recovery effects)
# - Solar rotation: 27 days (long-term modulation — too long for hourly data)
# Source: Huzaimy & Yumoto (2011), Marchitelli et al. (2020)
LAG_WINDOWS = [0, 6, 12, 24, 48, 72, 120, 168]

# Minimum effect size threshold
# r=0.05 with N=10000 is "significant" but physically meaningless.
# |r| > 0.1 is the minimum for meaningful cross-domain correlation.
MIN_EFFECT_SIZE = 0.1

# Continuous metrics that need first-order differencing
CONTINUOUS_METRICS = {
    "avg_temp",
    "avg_wind",
    "avg_density",
    "avg_speed",
    "avg_bt",
    "avg_bz_gsm",
    "avg_flux",
    "event_count",
}

# Domain → aggregate table mapping
DOMAIN_TABLES = {
    "seismic": "seismic_events",
    "solar_wind": "solar_wind_hourly",
    "goes": "goes_flux_hourly",
    "atmospheric": "atmospheric_daily",
}

# Table → time column name (raw hypertables use `time`; continuous
# aggregates rename it to `hour`/`day`)
TABLE_TIME_COLUMN = {
    "seismic_events": "time",
    "solar_wind": "time",
    "goes_flux": "time",
    "atmospheric_data": "time",
    "solar_wind_hourly": "hour",
    "goes_flux_hourly": "hour",
    "atmospheric_daily": "day",
}


class CorrelationEngine:
    """Discover cross-domain correlations with lag testing and Granger causality."""

    async def compute_correlation(
        self,
        pool: asyncpg.Pool,
        domain_a: str,
        metric_a: str,
        domain_b: str,
        metric_b: str,
        window_hours: int,
    ) -> dict | None:
        """Compute correlation between two metrics with lag testing.

        Tests multiple lag windows and returns the strongest correlation.
        Includes Granger causality test for directional inference.
        """
        results = []

        # If either domain is atmospheric, use daily bucketing to align them correctly
        use_daily = (domain_a == "atmospheric") or (domain_b == "atmospheric")
        bucket = "1 day" if use_daily else "1 hour"

        for lag_hours in LAG_WINDOWS:
            data_a = await self._query_metric(
                pool, domain_a, metric_a, window_hours + lag_hours, lag_hours, bucket=bucket
            )
            data_b = await self._query_metric(pool, domain_b, metric_b, window_hours, 0, bucket=bucket)

            if not data_a or not data_b:
                continue

            # Align by timestamp
            common_times = sorted(set(data_a.keys()) & set(data_b.keys()))
            if len(common_times) < 20:
                continue

            values_a = np.array([data_a[t] for t in common_times])
            values_b = np.array([data_b[t] for t in common_times])

            # Stationarity: first-order differencing for continuous metrics
            if metric_a in CONTINUOUS_METRICS and len(values_a) > 1:
                values_a = np.diff(values_a)
                values_b = values_b[1:]  # align after diff

            # Sanitize
            valid = np.isfinite(values_a) & np.isfinite(values_b)
            values_a = values_a[valid]
            values_b = values_b[valid]

            if len(values_a) < 20:
                continue
            if np.std(values_a) == 0 or np.std(values_b) == 0:
                continue

            try:
                pearson_r, pearson_p = stats.pearsonr(values_a, values_b)
                spearman_rho, spearman_p = stats.spearmanr(values_a, values_b)
            except ValueError:
                continue

            # Minimum effect size filter
            if abs(pearson_r) < MIN_EFFECT_SIZE and abs(spearman_rho) < MIN_EFFECT_SIZE:
                continue

            # Granger causality test (if enough samples)
            granger_p = None
            granger_causal = False
            if len(values_a) > 50:
                granger_p = self._granger_test(values_a, values_b)
                granger_causal = granger_p is not None and granger_p < 0.05

            correlation_id = hashlib.md5(
                f"{domain_a}:{metric_a}:{domain_b}:{metric_b}:{lag_hours}".encode()
            ).hexdigest()[:12]

            results.append(
                {
                    "domain_a": domain_a,
                    "metric_a": metric_a,
                    "domain_b": domain_b,
                    "metric_b": metric_b,
                    "window_hours": window_hours,
                    "lag_hours": lag_hours,
                    "pearson_r": float(pearson_r),
                    "spearman_rho": float(spearman_rho),
                    "p_value": float(min(pearson_p, spearman_p)),
                    "sample_size": len(values_a),
                    "correlation_id": correlation_id,
                    "granger_p": float(granger_p) if granger_p is not None else None,
                    "granger_causal": granger_causal,
                }
            )

        if not results:
            return None

        # Return strongest correlation across lag windows
        return max(results, key=lambda r: abs(r["pearson_r"]))

    @staticmethod
    def _granger_test(values_a: np.ndarray, values_b: np.ndarray, maxlag: int = 12) -> float | None:
        """Run Granger causality test: does past of A improve prediction of B?

        Returns minimum p-value across lag orders, or None if test fails.
        Uses F-test from statsmodels.tsa.stattools.grangercausalitytests.

        Note: Granger assumes LINEAR relationships. Solar wind forcing may
        be nonlinear — Transfer Entropy would be better for that (Priority 2).
        """
        try:
            from statsmodels.tsa.stattools import grangercausalitytests

            # Stack [B, A] — tests if A Granger-causes B
            data = np.column_stack([values_b, values_a])
            results = grangercausalitytests(data, maxlag=maxlag, verbose=False)

            # Extract minimum p-value across lag orders
            min_p = 1.0
            for lag_order in range(1, maxlag + 1):
                p_val = results[lag_order][0]["ssr_ftest"][1]
                min_p = min(min_p, p_val)

            return min_p
        except Exception:
            return None

    async def run_all(self, pool: asyncpg.Pool) -> list[dict]:
        """Run all correlation pairs and apply FDR correction.

        Uses Benjamini-Yekutieli (BY) instead of Benjamini-Hochberg (BH).
        BY is valid under ARBITRARY dependence structure. Our lag-correlated
        tests violate BH's independence assumption.

        Source: Benjamini & Yekutieli (2001) — "The control of the false
        discovery rate in multiple testing under dependency"
        """
        results = []
        raw_pvals = []

        for domain_a, metric_a, domain_b, metric_b, window in CORRELATION_PAIRS:
            result = await self.compute_correlation(
                pool, domain_a, metric_a, domain_b, metric_b, window
            )
            if result:
                results.append(result)
                raw_pvals.append(result["p_value"])

        if not raw_pvals:
            return []

        # Apply Benjamini-Yekutieli FDR correction
        # BY is valid under arbitrary dependence (our lag tests are dependent)
        # BH assumes independence — inappropriate for correlated lag tests
        from statsmodels.stats.multitest import multipletests

        reject, pvals_corrected, _, _ = multipletests(raw_pvals, alpha=0.05, method="fdr_by")

        for i, result in enumerate(results):
            result["p_value_corrected"] = float(pvals_corrected[i])
            result["is_significant"] = bool(reject[i])
            result["fdr_method"] = "benjamini_yekutieli"

        return [r for r in results if r["is_significant"]]

    async def _query_metric(
        self,
        pool: asyncpg.Pool,
        domain: str,
        metric: str,
        window_hours: int,
        lag_hours: int,
        bucket: str = "1 hour",
    ) -> dict:
        """Query a metric from the appropriate table, aligned to time buckets."""
        table = DOMAIN_TABLES.get(domain)
        if not table:
            return {}

        # For seismic: use energy proxy, not count
        # Energy: M0 = 10^(1.5*M + 4.8) in Newton-meters
        # Source: Kanamori (1977) — "The energy release in great earthquakes"
        if domain == "seismic" and metric == "event_count":
            select = "SUM(POWER(10, 1.5 * magnitude + 4.8)) AS value"
        elif metric.startswith("avg_") or metric.startswith("max_"):
            # Continuous aggregate columns are already aggregated (avg_bz_gsm, etc.)
            select = f"MAX({metric}) AS value"
        else:
            select = f"AVG({metric}) AS value"

        # Force daily bucket for atmospheric_daily as it has no hourly resolution
        actual_bucket = "1 day" if table == "atmospheric_daily" else bucket
        time_col = TABLE_TIME_COLUMN.get(table, "time")

        if lag_hours > 0:
            query = f"""
                SELECT time_bucket('{actual_bucket}', {time_col}) AS bucket, {select}
                FROM {table}
                WHERE {time_col} > NOW() - make_interval(hours => $1)
                  AND {time_col} < NOW() - make_interval(hours => $2)
                GROUP BY bucket ORDER BY bucket
            """
        else:
            query = f"""
                SELECT time_bucket('{actual_bucket}', {time_col}) AS bucket, {select}
                FROM {table}
                WHERE {time_col} > NOW() - make_interval(hours => $1)
                GROUP BY bucket ORDER BY bucket
            """

        async with pool.acquire() as conn:
            if lag_hours > 0:
                rows = await conn.fetch(query, window_hours, lag_hours)
            else:
                rows = await conn.fetch(query, window_hours)

        return {r["bucket"]: float(r["value"]) for r in rows if r["value"] is not None}


async def store_correlations(pool: asyncpg.Pool, correlations: list[dict]) -> int:
    """Store correlation results in the database."""
    if not correlations:
        return 0

    now = datetime.now(UTC)
    async with pool.acquire() as conn, conn.transaction():
        for c in correlations:
            await conn.execute(
                """
                    INSERT INTO correlations
                        (time, correlation_id, domain_a, metric_a,
                         domain_b, metric_b, window_hours, lag_hours,
                         pearson_r, spearman_rho, p_value,
                         p_value_corrected, fdr_method,
                         sample_size, is_significant)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                    ON CONFLICT (time, correlation_id) DO NOTHING
                    """,
                now,
                c["correlation_id"],
                c["domain_a"],
                c["metric_a"],
                c["domain_b"],
                c["metric_b"],
                c["window_hours"],
                c["lag_hours"],
                c["pearson_r"],
                c["spearman_rho"],
                c["p_value"],
                c.get("p_value_corrected"),
                c.get("fdr_method"),
                c["sample_size"],
                c.get("is_significant", False),
            )

    return len(correlations)
