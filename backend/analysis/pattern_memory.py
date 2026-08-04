"""Tethys — Pattern Memory.

Remembers and recognizes recurring planetary state patterns.
When a pattern recurs, Tethys can say "I have observed this N times."

Two-table architecture (per Phase 4 spec / Gemini review):
- pattern_catalog: unique patterns, ON CONFLICT DO UPDATE increments count
- pattern_events: append-only occurrence timeline

Binning is CRITICAL — raw floats produce different hashes for similar patterns.
Binning maps continuous values to discrete categories.
"""

import hashlib
import json
import logging
from datetime import UTC, datetime

import asyncpg

logger = logging.getLogger(__name__)

# Bin thresholds for pattern hashing
BIN_CONFIG = {
    "z_score": [
        (-999999, -5, "z_lt_neg5"), (-5, -4, "z_neg5_to_neg4"),
        (-4, -3, "z_neg4_to_neg3"), (-3, -2, "z_neg3_to_neg2"),
        (-2, 2, "z_normal"), (2, 3, "z_2_to_3"),
        (3, 4, "z_3_to_4"), (4, 5, "z_4_to_5"),
        (5, 999999, "z_gt_5"),
    ],
    "magnitude": [
        (0, 3, "mag_0_to_3"), (3, 4, "mag_3_to_4"),
        (4, 5, "mag_4_to_5"), (5, 6, "mag_5_to_6"),
        (6, 7, "mag_6_to_7"), (7, 999999, "mag_gt_7"),
    ],
    "speed": [
        (0, 300, "speed_lt_300"), (300, 500, "speed_300_to_500"),
        (500, 800, "speed_500_to_800"), (800, 999999, "speed_gt_800"),
    ],
    "density": [
        (0, 5, "density_0_to_5"), (5, 10, "density_5_to_10"),
        (10, 20, "density_10_to_20"), (20, 999999, "density_gt_20"),
    ],
    "bz_gsm": [
        (-999999, -10, "bz_lt_neg10"), (-10, -5, "bz_neg10_to_neg5"),
        (-5, 0, "bz_neg5_to_0"), (0, 5, "bz_0_to_5"),
        (5, 999999, "bz_gt_5"),
    ],
    "flux": [
        (0, 1e-6, "flux_A"), (1e-6, 1e-5, "flux_B"),
        (1e-5, 1e-4, "flux_C"), (1e-4, 1e-3, "flux_M"),
        (1e-3, 999999, "flux_X"),
    ],
}


def _bin_value(metric: str, value: float) -> str:
    """Convert raw float to categorical bin label."""
    # Map metric names to bin config keys
    bin_key = metric
    if "speed" in metric:
        bin_key = "speed"
    elif "density" in metric:
        bin_key = "density"
    elif "flux" in metric:
        bin_key = "flux"
    elif "bz" in metric:
        bin_key = "bz_gsm"
    elif "magnitude" in metric:
        bin_key = "magnitude"

    config = BIN_CONFIG.get(bin_key)
    if not config:
        return f"{metric}_{round(value, 0):.0f}"

    for low, high, label in config:
        if low <= value < high:
            return label
    return f"{metric}_unknown"


def _compute_signature(state: dict) -> dict:
    """Compute binned pattern signature from current state.

    State dict should contain:
    - domains: list of domain names
    - anomalies: list of {domain, metric, value, z_score}
    """
    signature: dict[str, object] = {
        "domains": sorted(state.get("domains", [])),
        "anomaly_count": len(state.get("anomalies", [])),
    }

    for anomaly in state.get("anomalies", []):
        metric = anomaly.get("metric", "unknown")
        value = anomaly.get("value", 0)
        z_score = anomaly.get("z_score", 0)

        signature[f"{metric}_bin"] = _bin_value(metric, value)
        signature[f"{metric}_z_bin"] = _bin_value("z_score", z_score)

    return signature


def _pattern_id(signature: dict) -> str:
    """Generate stable pattern ID from binned signature."""
    return hashlib.md5(
        json.dumps(signature, sort_keys=True, default=str).encode()
    ).hexdigest()[:12]


async def record_pattern(
    pool: asyncpg.Pool,
    state: dict,
    pattern_type: str = "anomaly_cluster",
    description: str = "",
) -> str:
    """Record a pattern occurrence in BOTH tables.

    Returns the pattern_id.
    """
    signature = _compute_signature(state)
    pattern_id = _pattern_id(signature)
    now = datetime.now(UTC)

    domains = sorted(state.get("domains", []))
    metrics = sorted({
        a.get("metric", "unknown") for a in state.get("anomalies", [])
    })
    activity_score = state.get("activity_score", 0)

    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                # 1. Upsert into pattern_catalog
                await conn.execute(
                    """
                    INSERT INTO pattern_catalog
                        (pattern_id, pattern_type, domains_involved,
                         metrics_involved, binned_signature, description,
                         first_seen, last_seen, occurrence_count,
                         avg_recurrence_interval_hours)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NULL)
                    ON CONFLICT (pattern_id) DO UPDATE SET
                        last_seen = EXCLUDED.last_seen,
                        occurrence_count = pattern_catalog.occurrence_count + 1,
                        avg_recurrence_interval_hours = (
                            CASE WHEN pattern_catalog.avg_recurrence_interval_hours IS NULL
                            THEN EXTRACT(EPOCH FROM (EXCLUDED.last_seen - pattern_catalog.last_seen)) / 3600
                            ELSE (
                                pattern_catalog.avg_recurrence_interval_hours * pattern_catalog.occurrence_count +
                                EXTRACT(EPOCH FROM (EXCLUDED.last_seen - pattern_catalog.last_seen)) / 3600
                            ) / (pattern_catalog.occurrence_count + 1)
                            END
                        )
                    """,
                    pattern_id,
                    pattern_type,
                    domains,
                    metrics,
                    json.dumps(signature, default=str),
                    description or f"{pattern_type} across {', '.join(domains)}",
                    now,
                    now,
                )

                # 2. Append to pattern_events
                await conn.execute(
                    """
                    INSERT INTO pattern_events
                        (time, pattern_id, activity_score, domains_active, raw_snapshot)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (time, pattern_id) DO NOTHING
                    """,
                    now,
                    pattern_id,
                    float(activity_score),
                    domains,
                    json.dumps(state, default=str),
                )

        logger.info(
            f"Pattern {pattern_id} recorded: {pattern_type} across {', '.join(domains)}"
        )
        return pattern_id

    except Exception as e:
        logger.error(f"Failed to record pattern: {e}")
        return pattern_id


async def check_pattern(
    pool: asyncpg.Pool,
    state: dict,
) -> dict | None:
    """Check if current state matches a known pattern in catalog.

    Returns dict with is_recurrence, times_seen, avg_interval, etc.
    or None if no match.
    """
    signature = _compute_signature(state)
    pattern_id = _pattern_id(signature)

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT pattern_id, description, occurrence_count,
                       avg_recurrence_interval_hours, first_seen, last_seen
                FROM pattern_catalog
                WHERE pattern_id = $1
                """,
                pattern_id,
            )

        if row:
            return {
                "is_recurrence": True,
                "pattern_id": row["pattern_id"],
                "times_seen": row["occurrence_count"],
                "avg_recurrence_interval": row["avg_recurrence_interval_hours"],
                "first_seen": row["first_seen"],
                "last_seen": row["last_seen"],
                "description": row["description"],
            }
    except Exception as e:
        logger.error(f"Failed to check pattern: {e}")

    return {"is_recurrence": False}
