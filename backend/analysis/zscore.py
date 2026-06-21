"""Tethys — Robust Z-Score Anomaly Detector.

Uses MAD (Median Absolute Deviation) instead of standard Z-score.
Earthquake magnitudes, solar flares follow heavy-tail distributions,
NOT normal. Standard Z-score → excessive false positives.

Formula: robust_z = 0.6745 * (x - median) / MAD
Source: Boris Iglewicz, David Hoaglin (1993) "How to Detect and Handle Outliers"
"""

import hashlib
import logging
from datetime import UTC, datetime, timedelta

import asyncpg
import numpy as np

logger = logging.getLogger(__name__)

# Detection matrix: (table, metric, domain, min_samples)
DETECTION_MATRIX = [
    ("seismic_events", "magnitude", "seismic", 100),
    ("solar_wind_hourly", "avg_bz_gsm", "solar_wind", 100),
    ("solar_wind_hourly", "avg_speed", "solar_wind", 100),
    ("solar_wind_hourly", "avg_density", "solar_wind", 100),
    ("goes_flux_hourly", "avg_flux", "goes", 100),
    ("atmospheric_daily", "avg_temp", "atmospheric", 50),
]

# SQL injection prevention
ALLOWED_TABLES = {
    "seismic_events",
    "solar_wind",
    "goes_flux",
    "atmospheric_data",
    "solar_wind_hourly",
    "goes_flux_hourly",
    "atmospheric_daily",
}

ALLOWED_METRICS = {
    "magnitude",
    "depth_km",
    "density",
    "speed",
    "temperature",
    "bt",
    "bz_gsm",
    "flux",
    "avg_flux",
    "avg_bz_gsm",
    "avg_speed",
    "avg_density",
    "avg_temp",
    "avg_wind",
    "max_speed",
    "event_count",
}


class ZScoreDetector:
    """Detect anomalies using Robust Z-score (MAD-based)."""

    def __init__(self, window_hours: int = 168, threshold: float = 3.0):
        self.window_hours = window_hours  # 7 days default
        self.threshold = threshold

    async def detect(self, pool: asyncpg.Pool, table: str, metric: str, domain: str) -> list[dict]:
        """Run robust Z-score anomaly detection on a metric.

        Returns list of anomaly dicts (empty if none found).
        """
        if table not in ALLOWED_TABLES:
            raise ValueError(f"Table '{table}' not in allowlist")
        if metric not in ALLOWED_METRICS:
            raise ValueError(f"Metric '{metric}' not in allowlist")

        async with pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT time, {metric} FROM {table} "
                f"WHERE time > NOW() - make_interval(hours => $1) "
                f"ORDER BY time",
                self.window_hours,
            )

        if len(rows) < 100:
            return []

        values = np.array([float(r[metric]) if r[metric] is not None else np.nan for r in rows])
        times = [r["time"] for r in rows]

        # Filter NaN/Inf
        valid_mask = np.isfinite(values)
        if not np.any(valid_mask):
            return []

        valid_values = values[valid_mask]

        # Robust Z-score using MAD
        median = np.nanmedian(valid_values)
        mad = np.nanmedian(np.abs(valid_values - median))

        if mad == 0 or np.isnan(mad):
            return []

        robust_z = 0.6745 * (values - median) / mad

        # Find anomalies in last 24 hours only
        cutoff = datetime.now(UTC) - timedelta(hours=24)
        anomalies = []

        for _i, (t, z, v) in enumerate(zip(times, robust_z, values, strict=False)):
            if t > cutoff and np.isfinite(z) and abs(z) > self.threshold:
                anomaly_id = hashlib.md5(f"{t.isoformat()}:{domain}:{metric}".encode()).hexdigest()[
                    :12
                ]

                anomalies.append(
                    {
                        "time": t,
                        "anomaly_id": anomaly_id,
                        "domain": domain,
                        "metric": metric,
                        "value": float(v),
                        "z_score": float(z),
                        "threshold": self.threshold,
                        "severity": self._classify_severity(abs(z)),
                        "description": f"{metric}={v:.2f} (z={z:.1f})",
                    }
                )

        return anomalies

    async def detect_all(self, pool: asyncpg.Pool) -> list[dict]:
        """Run detection across all metrics in DETECTION_MATRIX."""
        all_anomalies = []

        for table, metric, domain, _min_samples in DETECTION_MATRIX:
            try:
                anomalies = await self.detect(pool, table, metric, domain)
                all_anomalies.extend(anomalies)
            except Exception as e:
                logger.warning(f"Detection failed for {domain}/{metric}: {e}")

        return all_anomalies

    @staticmethod
    def _classify_severity(abs_z: float) -> str:
        if abs_z > 5.0:
            return "critical"
        if abs_z > 4.0:
            return "high"
        if abs_z > 3.0:
            return "medium"
        return "low"


async def store_anomalies(pool: asyncpg.Pool, anomalies: list[dict]) -> int:
    """Store detected anomalies in the database."""
    if not anomalies:
        return 0

    async with pool.acquire() as conn, conn.transaction():
        for a in anomalies:
            await conn.execute(
                """
                    INSERT INTO anomalies
                        (time, anomaly_id, domain, metric, value,
                         z_score, threshold, severity, description)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (time, anomaly_id) DO NOTHING
                    """,
                a["time"],
                a["anomaly_id"],
                a["domain"],
                a["metric"],
                a["value"],
                a["z_score"],
                a["threshold"],
                a["severity"],
                a["description"],
            )

    return len(anomalies)
