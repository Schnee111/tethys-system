"""Tethys — Cross-Domain Correlation Engine.

Discovers correlations between different planetary data streams.
Uses Pearson + Spearman correlation with time lag testing and
Benjamini-Hochberg FDR correction for multiple testing.
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
LAG_WINDOWS = [0, 24, 48, 72]

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


class CorrelationEngine:
    """Discover cross-domain correlations with lag testing."""

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

        Returns the strongest correlation across all lag windows.
        """
        results = []

        for lag_hours in LAG_WINDOWS:
            data_a = await self._query_metric(
                pool, domain_a, metric_a, window_hours + lag_hours, lag_hours
            )
            data_b = await self._query_metric(pool, domain_b, metric_b, window_hours, 0)

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
                }
            )

        if not results:
            return None

        # Return strongest correlation across lag windows
        return max(results, key=lambda r: abs(r["pearson_r"]))

    async def run_all(self, pool: asyncpg.Pool) -> list[dict]:
        """Run all correlation pairs and apply FDR correction."""
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

        # Apply Benjamini-Hochberg FDR correction
        from statsmodels.stats.multitest import multipletests

        reject, pvals_corrected, _, _ = multipletests(raw_pvals, alpha=0.05, method="fdr_bh")

        for i, result in enumerate(results):
            result["p_value_corrected"] = float(pvals_corrected[i])
            result["is_significant"] = bool(reject[i])
            result["fdr_method"] = "benjamini_hochberg"

        return [r for r in results if r["is_significant"]]

    async def _query_metric(
        self,
        pool: asyncpg.Pool,
        domain: str,
        metric: str,
        window_hours: int,
        lag_hours: int,
    ) -> dict:
        """Query a metric from the appropriate table, aligned to time buckets."""
        table = DOMAIN_TABLES.get(domain)
        if not table:
            return {}

        # For seismic: use energy proxy, not count
        if domain == "seismic" and metric == "event_count":
            select = "SUM(POWER(10, 1.5 * magnitude + 4.8)) AS value"
        else:
            select = f"AVG({metric}) AS value"

        bucket = "1 hour" if table != "atmospheric_daily" else "1 day"

        if lag_hours > 0:
            query = f"""
                SELECT time_bucket('{bucket}', time) AS bucket, {select}
                FROM {table}
                WHERE time > NOW() - make_interval(hours => $1)
                  AND time < NOW() - make_interval(hours => $2)
                GROUP BY bucket ORDER BY bucket
            """
        else:
            query = f"""
                SELECT time_bucket('{bucket}', time) AS bucket, {select}
                FROM {table}
                WHERE time > NOW() - make_interval(hours => $1)
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
