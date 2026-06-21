"""Tethys — Activity Assessor.

Computes composite planetary activity score from anomalies and correlations.
Includes confidence propagation — if data sources are stale, confidence drops.

Renamed from "Threat" to "Activity". This is observation, not prediction.
"""

import hashlib
import logging
from datetime import UTC, datetime

import asyncpg
import numpy as np

logger = logging.getLogger(__name__)

# Domain weights (sum = 0.75, correlation adds 0.25, total max = 1.0)
SOURCE_CONFIG = {
    "seismic": {"max_staleness_minutes": 10, "weight": 0.225},
    "solar_wind": {"max_staleness_minutes": 15, "weight": 0.1875},
    "goes": {"max_staleness_minutes": 10, "weight": 0.15},
    "atmospheric": {"max_staleness_minutes": 120, "weight": 0.075},
    "volcanic": {"max_staleness_minutes": 180, "weight": 0.0375},
    "space_weather": {"max_staleness_minutes": 60, "weight": 0.075},
}

# Domain → table for freshness check
DOMAIN_TABLES = {
    "seismic": "seismic_events",
    "solar_wind": "solar_wind",
    "goes": "goes_flux",
    "atmospheric": "atmospheric_data",
    "volcanic": "volcanic_events",
    "space_weather": "space_weather_events",
}


class ActivityAssessor:
    """Compute composite planetary activity score."""

    async def assess(self, pool: asyncpg.Pool) -> dict:
        """Generate activity assessment with uncertainty."""
        # Count anomalies per domain (last 24h)
        anomalies = await self._count_anomalies(pool)

        # Get significant correlations
        correlations = await self._get_significant_correlations(pool)

        # Check source freshness
        source_status = await self._check_source_freshness(pool)
        available = sum(1 for s in source_status.values() if s["is_fresh"])
        total = len(source_status)

        # Compute weighted score
        score = 0.0
        score_breakdown = {}

        for domain, config in SOURCE_CONFIG.items():
            if source_status.get(domain, {}).get("is_fresh", False):
                domain_score = min(anomalies.get(domain, 0) / 5, 1.0) * config["weight"]
                score += domain_score
                score_breakdown[domain] = round(domain_score, 3)

        # Correlation component
        corr_score = min(len(correlations) / 3, 1.0) * 0.25
        score += corr_score
        score_breakdown["cross_correlation"] = round(corr_score, 3)

        # Confidence = coverage * avg_freshness
        coverage = available / total if total > 0 else 0
        freshness_scores = []
        for s in source_status.values():
            if s["age_minutes"] < float("inf"):
                freshness = min(1.0, s["max_staleness"] / max(s["age_minutes"], 1))
            else:
                freshness = 0.0
            freshness_scores.append(freshness)

        avg_freshness = np.mean(freshness_scores) if freshness_scores else 0
        confidence = round(coverage * avg_freshness, 3)

        # Classify level
        if score > 0.8:
            level = "intense"
        elif score > 0.6:
            level = "high"
        elif score > 0.3:
            level = "elevated"
        else:
            level = "nominal"

        domains_affected = [d for d, c in anomalies.items() if c > 0]

        summary = self._generate_summary(
            anomalies, correlations, level, available, total, confidence
        )

        return {
            "activity_level": level,
            "activity_score": round(score, 3),
            "confidence": confidence,
            "coverage": f"{available}/{total}",
            "score_breakdown": score_breakdown,
            "active_anomalies": sum(anomalies.values()),
            "active_correlations": len(correlations),
            "domains_affected": domains_affected,
            "summary": summary,
        }

    async def _count_anomalies(self, pool: asyncpg.Pool) -> dict:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT domain, COUNT(*) as cnt
                FROM anomalies
                WHERE time > NOW() - make_interval(hours => 24)
                GROUP BY domain
                """
            )
        return {r["domain"]: r["cnt"] for r in rows}

    async def _get_significant_correlations(self, pool: asyncpg.Pool) -> list:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM correlations
                WHERE time > NOW() - make_interval(hours => 24)
                  AND is_significant = true
                ORDER BY time DESC
                """
            )
        return [dict(r) for r in rows]

    async def _check_source_freshness(self, pool: asyncpg.Pool) -> dict:
        status = {}
        for domain, config in SOURCE_CONFIG.items():
            table = DOMAIN_TABLES.get(domain)
            if not table:
                continue

            async with pool.acquire() as conn:
                row = await conn.fetchrow(f"SELECT MAX(time) AS latest FROM {table}")

            if row and row["latest"]:
                age = (datetime.now(UTC) - row["latest"]).total_seconds() / 60
                status[domain] = {
                    "age_minutes": round(age, 1),
                    "max_staleness": config["max_staleness_minutes"],
                    "is_fresh": age <= config["max_staleness_minutes"],
                }
            else:
                status[domain] = {
                    "age_minutes": float("inf"),
                    "max_staleness": config["max_staleness_minutes"],
                    "is_fresh": False,
                }

        return status

    @staticmethod
    def _generate_summary(anomalies, correlations, level, available, total, confidence):
        parts = []

        if available < total:
            parts.append(
                f"Data coverage: {available}/{total} sources (confidence: {confidence * 100:.0f}%)"
            )

        if anomalies.get("seismic", 0) > 0:
            parts.append(f"{anomalies['seismic']} seismic anomalies")
        if anomalies.get("solar_wind", 0) > 0:
            parts.append("solar wind elevated")
        if anomalies.get("goes", 0) > 0:
            parts.append("GOES flux anomalies")

        if correlations:
            parts.append(f"{len(correlations)} cross-domain correlations")

        if not parts:
            return "All planetary systems nominal."

        return (
            f"Activity: {level.upper()} ({confidence * 100:.0f}% confidence). "
            + ". ".join(parts)
            + "."
        )


async def store_assessment(pool: asyncpg.Pool, assessment: dict) -> None:
    """Store activity assessment in the database."""
    assessment_id = hashlib.md5(f"{datetime.now(UTC).isoformat()}:activity".encode()).hexdigest()[
        :12
    ]

    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO activity_assessments
                (time, assessment_id, activity_level, activity_score,
                 confidence, coverage, score_breakdown,
                 active_anomalies, active_correlations,
                 domains_affected, summary, details)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            """,
            datetime.now(UTC),
            assessment_id,
            assessment["activity_level"],
            assessment["activity_score"],
            assessment["confidence"],
            assessment["coverage"],
            assessment["score_breakdown"],
            assessment["active_anomalies"],
            assessment["active_correlations"],
            assessment["domains_affected"],
            assessment["summary"],
            assessment,
        )
