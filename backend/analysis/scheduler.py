"""Tethys — Analysis Scheduler.

Runs analysis tasks on schedule:
- Anomaly detection: every 15 minutes
- Correlation: every 1 hour
- Activity assessment: every 15 minutes
"""

import asyncio
import logging
import time

import asyncpg

from backend.analysis.activity import ActivityAssessor, store_assessment
from backend.analysis.correlation import CorrelationEngine, store_correlations
from backend.analysis.zscore import ZScoreDetector, store_anomalies

logger = logging.getLogger(__name__)


async def run_analysis_cycle(pool: asyncpg.Pool, detector: ZScoreDetector) -> None:
    """Run one anomaly detection + activity assessment cycle."""
    # Detect anomalies
    anomalies = await detector.detect_all(pool)
    if anomalies:
        count = await store_anomalies(pool, anomalies)
        logger.info(f"Detected {count} anomalies")

    # Activity assessment
    assessor = ActivityAssessor()
    assessment = await assessor.assess(pool)
    await store_assessment(pool, assessment)
    logger.info(f"Activity: {assessment['activity_level']} (score={assessment['activity_score']})")


async def analysis_scheduler(pool: asyncpg.Pool) -> None:
    """Run analysis tasks on schedule. Runs forever."""
    detector = ZScoreDetector()
    correlator = CorrelationEngine()

    last_correlation_run = 0

    logger.info("Analysis scheduler starting...")

    while True:
        start = time.time()
        try:
            # Anomaly detection + activity assessment — every 15 minutes
            await run_analysis_cycle(pool, detector)

            # Correlation — every 1 hour
            now = time.time()
            if now - last_correlation_run >= 3600:
                correlations = await correlator.run_all(pool)
                if correlations:
                    count = await store_correlations(pool, correlations)
                    logger.info(f"Found {count} significant correlations")
                last_correlation_run = now

        except Exception as e:
            logger.error(f"Analysis error: {e}")

        elapsed = time.time() - start
        sleep_time = max(0, 900 - elapsed)  # 15 minutes
        await asyncio.sleep(sleep_time)
