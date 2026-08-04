"""Tethys — Lament Detector.

The core concept from Wuthering Waves — watching for cascading failures
across planetary systems. Not predicting catastrophe — detecting when
the data converges.

Valid cascade: global trigger (solar_wind/goes) + local event (seismic/atmospheric)
Invalid cascade: two local random events (rain + earthquake = noise)
"""

import logging

import asyncpg

logger = logging.getLogger(__name__)

# Minimum domains with active anomalies to trigger cascade detection
CASCADE_THRESHOLD = 2

# Global trigger domains — at least ONE must be active for a cascade to be valid.
# Two local random events (rain + earthquake) are NOT a Lament pattern.
# A solar event correlating with seismic IS.
GLOBAL_TRIGGERS = {"solar_wind", "goes"}

# Minimum activity score to trigger lament warning
LAMENT_THRESHOLD = 0.3  # lowered from 0.6 — we're early, data scarce


async def detect_lament(
    pool: asyncpg.Pool,
    assessment: dict,
    recent_anomalies: list[dict],
) -> dict | None:
    """Check for cascading anomalies (the 'Lament' pattern).

    A valid Lament requires:
    1. ≥ CASCADE_THRESHOLD domains with active anomalies
    2. At least one global trigger domain active (solar_wind or goes)
    3. Activity score ≥ LAMENT_THRESHOLD

    Returns None if conditions not met, or a lament dict if detected.
    """
    # Get domains with active anomalies (last 6 hours)
    active_domains: set[str] = set()
    domain_anomaly_counts: dict[str, int] = {}

    for anomaly in recent_anomalies:
        domain = anomaly.get("domain", "")
        active_domains.add(domain)
        domain_anomaly_counts[domain] = domain_anomaly_counts.get(domain, 0) + 1

    if len(active_domains) < CASCADE_THRESHOLD:
        return None

    # Must have at least one global trigger
    has_global_trigger = bool(active_domains & GLOBAL_TRIGGERS)
    if not has_global_trigger:
        return None

    activity_score = float(assessment.get("activity_score", 0))
    if activity_score < LAMENT_THRESHOLD:
        return None

    # Check pattern memory for recurrence info
    from backend.analysis.pattern_memory import check_pattern, record_pattern

    state = {
        "domains": list(active_domains),
        "anomalies": recent_anomalies[:10],  # Top 10 for signature
        "activity_score": activity_score,
    }

    pattern_info = await check_pattern(pool, state)
    if pattern_info is None:
        pattern_info = {"is_recurrence": False}
    is_recurrence = pattern_info.get("is_recurrence", False)

    # Record this pattern occurrence
    description = (
        f"Cascade across {', '.join(sorted(active_domains))} "
        f"(activity={activity_score:.2f})"
    )
    pattern_id = await record_pattern(
        pool, state, pattern_type="cascade", description=description
    )

    # Build lament result
    lament = {
        "type": "cascade",
        "pattern_id": pattern_id,
        "domains": sorted(active_domains),
        "domain_counts": domain_anomaly_counts,
        "activity_score": activity_score,
        "activity_level": assessment.get("activity_level", "unknown"),
        "is_recurrence": is_recurrence,
        "times_seen": pattern_info.get("times_seen", 1) if is_recurrence else 1,
        "avg_recurrence_interval_hours": pattern_info.get("avg_recurrence_interval"),
        "narrative": _generate_lament_narrative(
            sorted(active_domains), assessment, pattern_info, is_recurrence
        ),
    }

    logger.warning(
        f"LAMENT DETECTED: {lament['domains']} (activity={activity_score:.2f}, "
        f"times_seen={lament['times_seen']})"
    )

    return lament


def _generate_lament_narrative(
    domains: list[str],
    assessment: dict,
    pattern_info: dict,
    is_recurrence: bool,
) -> str:
    """Generate the Lament narrative text."""
    domain_list = ", ".join(d.replace("_", " ") for d in domains)
    score = float(assessment.get("activity_score", 0))
    level = assessment.get("activity_level", "unknown").upper()

    if is_recurrence and pattern_info.get("times_seen", 1) > 1:
        times = pattern_info["times_seen"]
        interval = pattern_info.get("avg_recurrence_interval")
        interval_str = f" (avg every {interval:.0f}h)" if interval else ""
        return (
            f"I have seen this convergence before — {times} times{interval_str}. "
            f"Multiple planetary systems are in distress: {domain_list}. "
            f"Activity level: {level} ({score:.0%}). "
            f"The pattern repeats. I am watching."
        )

    return (
        f"Multiple planetary systems are showing correlated anomalies: {domain_list}. "
        f"Activity level: {level} ({score:.0%}). "
        f"This is the first time I have observed this configuration. "
        f"All data streams are being tracked at maximum resolution."
    )
