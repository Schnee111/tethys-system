"""Tethys — Narrative Generator.

Tethys speaks in natural language. Not raw data — insights.
Template-based (deterministic, no LLM call). Reads current anomalies,
activity assessment, and correlations from DB, generates a natural
language description of the planetary state.

Phase 4 spec: 4 template categories:
- nominal: all systems quiet
- anomaly_observation: single-domain anomaly highlight
- correlation_insight: cross-domain signal detected
- cascade_warning: multiple domains anomalous simultaneously

Future: upgrade to LLM-backed generation (9router available).
"""

import logging
import random
from datetime import UTC, datetime

import asyncpg

logger = logging.getLogger(__name__)

TEMPLATES = {
    "nominal": [
        "All planetary systems are operating within normal parameters. "
        "No significant anomalies detected across {domain_count} monitored domains. "
        "Solar wind speed: {sw_speed} km/s. Seismic activity: nominal.",

        "The planet is quiet. {domain_count} domains monitored, "
        "{anomaly_count} anomalies in the past 24 hours (all within normal range). "
        "Current threat level: NOMINAL.",

        "I detect no unusual activity. {domain_count} planetary systems under surveillance. "
        "Solar wind stable, seismic patterns nominal. The Earth rests.",
    ],
    "anomaly_observation": [
        "I am detecting {anomaly_count} anomalies in the {domain} domain. "
        "{metric} has reached {value}, which is {z_score:.1f} standard deviations "
        "from the norm.",

        "A {severity} anomaly in {domain} data: {metric} = {value} "
        "(z-score: {z_score:.1f}). This places it in the top percentile "
        "of observed values over the past 24 hours.",
    ],
    "correlation_insight": [
        "I have identified a correlation between {domain_a} ({metric_a}) "
        "and {domain_b} ({metric_b}). Over the past {window} hours, "
        "the Pearson coefficient is {r:.3f} (p={p:.4f}).",

        "Cross-domain signal detected: {domain_a} {metric_a} and "
        "{domain_b} {metric_b} show a correlation (r={r:.3f}). "
        "This warrants further observation.",
    ],
    "cascade_warning": [
        "⚠️ Multiple domains are showing simultaneous anomalies: "
        "{domains_list}. Current threat level: {activity_level}.",

        "I am monitoring a developing situation across {domain_count} "
        "planetary systems. {anomaly_summary}. "
        "Current threat level: {activity_level}.",
    ],
}


async def _get_latest_sw_speed(pool: asyncpg.Pool) -> float:
    """Get latest solar wind speed for narrative context."""
    try:
        row = await pool.fetchrow(
            "SELECT avg_speed FROM solar_wind_hourly ORDER BY hour DESC LIMIT 1"
        )
        return float(row["avg_speed"]) if row else 0.0
    except Exception:
        return 0.0


async def _get_top_anomaly(pool: asyncpg.Pool) -> dict | None:
    """Get the most significant recent anomaly."""
    try:
        row = await pool.fetchrow(
            """
            SELECT domain, metric, value, z_score, severity, description
            FROM anomalies
            WHERE time > NOW() - INTERVAL '24 hours'
            ORDER BY ABS(z_score) DESC
            LIMIT 1
            """
        )
        if not row:
            return None
        return dict(row)
    except Exception:
        return None


async def _get_latest_correlation(pool: asyncpg.Pool) -> dict | None:
    """Get the most significant recent correlation."""
    try:
        row = await pool.fetchrow(
            """
            SELECT domain_a, metric_a, domain_b, metric_b,
                   pearson_r, p_value, window_hours
            FROM correlations
            ORDER BY time DESC
            LIMIT 1
            """
        )
        if not row:
            return None
        return dict(row)
    except Exception:
        return None


async def generate_narrative(
    pool: asyncpg.Pool,
    activity: dict | None = None,
) -> dict:
    """Generate a narrative based on current planetary state.

    Args:
        pool: Database connection pool
        activity: Latest activity assessment dict (optional — will query if None)

    Returns:
        Dict with: text, narrative_type, timestamp, severity
    """
    now = datetime.now(UTC)
    domain_count = 6  # solar_wind, goes, seismic, atmospheric, space_weather, geomagnetic

    # Get activity assessment if not provided
    if activity is None:
        try:
            row = await pool.fetchrow(
                "SELECT * FROM activity_assessments ORDER BY time DESC LIMIT 1"
            )
            activity = dict(row) if row else {}
        except Exception:
            activity = {}

    activity_level = activity.get("activity_level", "nominal")
    active_anomalies = activity.get("active_anomalies", 0)
    domains_affected = activity.get("domains_affected", [])

    # Determine narrative type based on state
    # Check for lament (cascade) first
    from backend.analysis.lament_detector import detect_lament

    # Fetch recent anomalies for lament check
    try:
        recent_rows = await pool.fetch(
            """
            SELECT domain, metric, value, z_score, severity
            FROM anomalies
            WHERE time > NOW() - INTERVAL '6 hours'
            ORDER BY ABS(z_score) DESC
            LIMIT 20
            """
        )
        recent_anomalies = [dict(r) for r in recent_rows]
    except Exception:
        recent_anomalies = []

    lament = None
    try:
        lament = await detect_lament(pool, activity, recent_anomalies)
    except Exception as e:
        logger.debug(f"Lament detection in narrative skipped: {e}")

    if lament:
        # Cascade warning with pattern memory
        narrative_type = "cascade_warning"
        text = lament["narrative"]
        severity = "critical" if lament["activity_score"] >= 0.5 else "high"

    elif activity_level in ("high", "intense") and len(domains_affected) >= 2:
        # Cascade warning — multiple domains anomalous
        narrative_type = "cascade_warning"
        template = random.choice(TEMPLATES["cascade_warning"])
        text = template.format(
            domain_count=domain_count,
            anomaly_count=active_anomalies,
            domains_list=", ".join(domains_affected),
            activity_level=activity_level.upper(),
            anomaly_summary=f"{active_anomalies} active anomalies across {len(domains_affected)} domains",
        )
        severity = "critical"

    elif active_anomalies > 0:
        # Anomaly observation — highlight the most significant
        top = await _get_top_anomaly(pool)
        if top:
            narrative_type = "anomaly_observation"
            template = random.choice(TEMPLATES["anomaly_observation"])
            text = template.format(
                anomaly_count=active_anomalies,
                domain=top["domain"].replace("_", " "),
                metric=top["metric"],
                value=f"{top['value']:.2f}",
                z_score=abs(top["z_score"]),
                severity=top["severity"],
            )
            severity = top["severity"]
        else:
            narrative_type = "nominal"
            sw_speed = await _get_latest_sw_speed(pool)
            template = random.choice(TEMPLATES["nominal"])
            text = template.format(
                domain_count=domain_count,
                anomaly_count=active_anomalies,
                sw_speed=f"{sw_speed:.0f}",
            )
            severity = "low"

    else:
        # Check for correlation insight
        corr = await _get_latest_correlation(pool)
        if corr:
            narrative_type = "correlation_insight"
            template = random.choice(TEMPLATES["correlation_insight"])
            text = template.format(
                domain_a=corr["domain_a"].replace("_", " "),
                metric_a=corr["metric_a"],
                domain_b=corr["domain_b"].replace("_", " "),
                metric_b=corr["metric_b"],
                window=corr["window_hours"],
                r=corr["pearson_r"],
                p=corr["p_value"],
            )
            severity = "medium"
        else:
            # Truly nominal
            narrative_type = "nominal"
            sw_speed = await _get_latest_sw_speed(pool)
            template = random.choice(TEMPLATES["nominal"])
            text = template.format(
                domain_count=domain_count,
                anomaly_count=active_anomalies,
                sw_speed=f"{sw_speed:.0f}",
            )
            severity = "low"

    return {
        "text": text,
        "narrative_type": narrative_type,
        "severity": severity,
        "timestamp": now.isoformat(),
        "activity_level": activity_level,
        "active_anomalies": active_anomalies,
        "domains_affected": domains_affected,
    }
