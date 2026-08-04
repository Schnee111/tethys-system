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


async def _run_advanced_correlation(pool: asyncpg.Pool, correlator: CorrelationEngine) -> None:
    """Run advanced correlation methods (Transfer Entropy + Wavelet Coherence).

    These are more expensive than Pearson/Spearman, so run less frequently.
    Gracefully degrades if dependencies missing or insufficient data.
    """
    from backend.analysis.correlation import CORRELATION_PAIRS

    logger.info("Running advanced correlation analysis (TE + Wavelet)...")

    te_results = []
    wavelet_results = []

    # Use a subset of pairs for advanced analysis (most important ones)
    # Same pairs as CORRELATION_PAIRS but we could filter to high-priority ones
    for domain_a, metric_a, domain_b, metric_b, window in CORRELATION_PAIRS:
        # Transfer Entropy (nonlinear causality)
        try:
            te = await correlator.compute_transfer_entropy(
                pool, domain_a, metric_a, domain_b, metric_b, window
            )
            if te:
                te_results.append(te)
        except Exception as e:
            logger.debug(f"TE skipped for {domain_a}/{metric_a} → {domain_b}/{metric_b}: {e}")

        # Wavelet Coherence (time-frequency correlation)
        try:
            wc = await correlator.compute_wavelet_coherence(
                pool, domain_a, metric_a, domain_b, metric_b, window
            )
            if wc:
                wavelet_results.append(wc)
        except Exception as e:
            logger.debug(f"Wavelet skipped for {domain_a}/{metric_a} → {domain_b}/{metric_b}: {e}")

    if te_results:
        logger.info(f"Transfer Entropy: {len(te_results)} pairs analyzed")
    if wavelet_results:
        logger.info(f"Wavelet Coherence: {len(wavelet_results)} pairs analyzed")

    # TODO: Store advanced results in DB (add columns to correlations table)
    # For now, just log. Once data accumulates, we can visualize these.


async def run_analysis_cycle(pool: asyncpg.Pool, detector: ZScoreDetector) -> None:
    """Run one anomaly detection + activity assessment + lament check cycle."""
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

    # Lament detection (cascade check) — only if anomalies present
    if anomalies and assessment.get("active_anomalies", 0) > 0:
        from backend.analysis.lament_detector import detect_lament

        try:
            lament = await detect_lament(pool, assessment, anomalies)
            if lament:
                logger.warning(
                    f"LAMENT: {lament['domains']} "
                    f"(score={lament['activity_score']:.2f}, "
                    f"times_seen={lament['times_seen']})"
                )
        except Exception as e:
            logger.debug(f"Lament detection skipped: {e}")


async def analysis_scheduler(pool: asyncpg.Pool) -> None:
    """Run analysis tasks on schedule. Runs forever."""
    detector = ZScoreDetector()
    correlator = CorrelationEngine()

    last_correlation_run = 0
    last_advanced_run = 0  # Transfer Entropy + Wavelet — every 6 hours

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

            # Advanced correlation (TE + Wavelet) — every 6 hours
            if now - last_advanced_run >= 21600:
                await _run_advanced_correlation(pool, correlator)
                last_advanced_run = now

        except Exception as e:
            logger.error(f"Analysis error: {e}")

        elapsed = time.time() - start
        sleep_time = max(0, 900 - elapsed)  # 15 minutes
        await asyncio.sleep(sleep_time)
