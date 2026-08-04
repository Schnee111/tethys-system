"""Tethys — Analysis Query Endpoints.

REST API for querying anomalies, correlations, and activity assessments.
"""

from fastapi import APIRouter, Query

from backend.db.connection import get_pool

router = APIRouter()


@router.get("/api/v1/anomalies")
async def get_anomalies(
    hours: int = Query(default=24, ge=1, le=168),
    domain: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
):
    """Query detected anomalies."""
    pool = await get_pool()
    conditions = ["time > NOW() - make_interval(hours => $1)"]
    params: list = [hours]
    idx = 2

    if domain:
        conditions.append(f"domain = ${idx}")
        params.append(domain)
        idx += 1
    if severity:
        conditions.append(f"severity = ${idx}")
        params.append(severity)
        idx += 1

    where = " AND ".join(conditions)
    params.append(limit)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT time, anomaly_id, domain, metric, value,
                   z_score, threshold, severity, description
            FROM anomalies
            WHERE {where}
            ORDER BY time DESC
            LIMIT ${idx}
            """,  # noqa: S608
            *params,
        )

    return {"count": len(rows), "anomalies": [dict(r) for r in rows]}


@router.get("/api/v1/correlations")
async def get_correlations(
    hours: int = Query(default=24, ge=1, le=168),
    significant_only: bool = Query(default=True),
    limit: int = Query(default=50, ge=1, le=500),
):
    """Query cross-domain correlations."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        if significant_only:
            rows = await conn.fetch(
                """
                SELECT * FROM correlations
                WHERE time > NOW() - make_interval(hours => $1)
                  AND is_significant = true
                ORDER BY time DESC
                LIMIT $2
                """,
                hours,
                limit,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT * FROM correlations
                WHERE time > NOW() - make_interval(hours => $1)
                ORDER BY time DESC
                LIMIT $2
                """,
                hours,
                limit,
            )

    return {"count": len(rows), "correlations": [dict(r) for r in rows]}


@router.get("/api/v1/activity")
async def get_activity():
    """Latest activity assessment."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT * FROM activity_assessments
            ORDER BY time DESC
            LIMIT 1
            """
        )

    return dict(row) if row else {"activity_level": "unknown", "activity_score": 0}


@router.get("/api/v1/narrative")
async def get_narrative():
    """Generate a natural-language description of current planetary state.

    Template-based (deterministic). Returns text + metadata.
    Includes Lament detection (cascade warning with pattern memory).
    """
    from backend.analysis.narrative import generate_narrative

    pool = await get_pool()
    result = await generate_narrative(pool)
    return result


@router.get("/api/v1/patterns")
async def get_patterns(limit: int = Query(default=20, ge=1, le=100)):
    """Query pattern catalog — recurring planetary state patterns."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT pattern_id, pattern_type, domains_involved, metrics_involved,
                   description, first_seen, last_seen, occurrence_count,
                   avg_recurrence_interval_hours
            FROM pattern_catalog
            ORDER BY last_seen DESC
            LIMIT $1
            """,
            limit,
        )
    return {"count": len(rows), "patterns": [dict(r) for r in rows]}
