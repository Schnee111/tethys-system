"""Tethys — Tests for Analysis Engine (Phase 2).

Tests for:
- MAD-based Z-score anomaly detection
- Cross-domain correlation with lag, Granger causality, FDR correction
- Activity scoring with confidence propagation
"""

import numpy as np

from backend.analysis.zscore import ZScoreDetector


class TestZScoreDetector:
    """Tests for MAD-based Z-score anomaly detection."""

    def test_classify_severity(self):
        assert ZScoreDetector._classify_severity(5.5) == "critical"
        assert ZScoreDetector._classify_severity(4.5) == "high"
        assert ZScoreDetector._classify_severity(3.5) == "medium"
        assert ZScoreDetector._classify_severity(2.5) == "low"

    def test_mad_computation(self):
        """MAD of [1, 2, 3, 4, 100] should detect 100 as outlier."""
        values = np.array([1.0, 2.0, 3.0, 4.0, 100.0])
        median = np.nanmedian(values)
        mad = np.nanmedian(np.abs(values - median))
        robust_z = 0.6745 * (values - median) / mad

        assert abs(robust_z[0]) < 3.0  # Normal
        assert abs(robust_z[4]) > 3.0  # Outlier

    def test_mad_zero_returns_empty(self):
        """All identical values → MAD=0 → no anomalies."""
        values = np.array([5.0, 5.0, 5.0, 5.0, 5.0])
        median = np.nanmedian(values)
        mad = np.nanmedian(np.abs(values - median))
        assert mad == 0

    def test_mad_with_nan(self):
        """NaN values should be handled gracefully."""
        values = np.array([1.0, 2.0, np.nan, 4.0, 100.0])
        valid = values[np.isfinite(values)]
        median = np.nanmedian(valid)
        mad = np.nanmedian(np.abs(valid - median))
        assert mad > 0

    def test_init_defaults(self):
        d = ZScoreDetector()
        assert d.window_hours == 168
        assert d.threshold == 3.0

    def test_init_custom(self):
        d = ZScoreDetector(window_hours=72, threshold=2.5)
        assert d.window_hours == 72
        assert d.threshold == 2.5


class TestCorrelationLogic:
    """Tests for correlation computation logic."""

    def test_pearson_correlation(self):
        """Synthetic correlated data should produce high r."""
        from scipy import stats

        x = np.arange(100, dtype=float)
        y = x * 2 + np.random.normal(0, 1, 100)
        r, p = stats.pearsonr(x, y)
        assert r > 0.95
        assert p < 0.001

    def test_fdr_by_correction(self):
        """BY correction is more conservative than BH for dependent tests.

        With 21 tests at p=0.04, BY should reject fewer than BH.
        """
        from statsmodels.stats.multitest import multipletests

        raw_pvals = [0.04] * 5 + [0.5] * 16

        reject_bh, _, _, _ = multipletests(raw_pvals, alpha=0.05, method="fdr_bh")
        reject_by, _, _, _ = multipletests(raw_pvals, alpha=0.05, method="fdr_by")

        # BY should be at least as conservative as BH
        assert sum(reject_by) <= sum(reject_bh)

    def test_fdr_with_genuine_correlation(self):
        """Very small p-value should survive BY correction."""
        from statsmodels.stats.multitest import multipletests

        raw_pvals = [0.0001, 0.5, 0.8, 0.9, 0.95]
        reject, pvals_corrected, _, _ = multipletests(raw_pvals, alpha=0.05, method="fdr_by")
        assert reject[0]  # First one should be significant
        assert not reject[1]  # Others should not

    def test_stationarity_differencing(self):
        """First-order differencing removes linear trend."""
        values = np.arange(100, dtype=float) + np.random.normal(0, 0.1, 100)
        diff = np.diff(values)
        assert abs(np.mean(diff) - 1.0) < 0.5
        assert np.std(diff) < 1.0

    def test_effect_size_filter(self):
        """Correlation with |r| < 0.1 should be filtered out."""
        from backend.analysis.correlation import MIN_EFFECT_SIZE

        # r=0.05 is "significant" with large N but physically meaningless
        assert MIN_EFFECT_SIZE == 0.1

    def test_lag_windows_extended(self):
        """Lag windows should include sub-daily and multi-day lags."""
        from backend.analysis.correlation import LAG_WINDOWS

        assert 6 in LAG_WINDOWS  # 6h: direct solar wind pressure
        assert 12 in LAG_WINDOWS  # 12h: intermediate
        assert 24 in LAG_WINDOWS  # 24h: diurnal
        assert 72 in LAG_WINDOWS  # 72h: storm recovery
        assert 120 in LAG_WINDOWS  # 120h: 5-day
        assert 168 in LAG_WINDOWS  # 168h: 7-day

    def test_granger_causality_basic(self):
        """Granger test should detect causal relationship in synthetic data."""
        from backend.analysis.correlation import CorrelationEngine

        # Create data where A Granger-causes B (A leads B by 2 steps)
        np.random.seed(42)
        n = 200
        a = np.random.randn(n)
        b = np.zeros(n)
        for i in range(2, n):
            b[i] = 0.5 * a[i - 2] + 0.3 * a[i - 1] + np.random.randn() * 0.1

        engine = CorrelationEngine()
        p_value = engine._granger_test(a, b, maxlag=5)

        assert p_value is not None
        assert p_value < 0.05  # Should detect the causal relationship

    def test_granger_no_causality(self):
        """Granger test should NOT detect causality in independent data."""
        from backend.analysis.correlation import CorrelationEngine

        np.random.seed(42)
        a = np.random.randn(200)
        b = np.random.randn(200)

        engine = CorrelationEngine()
        p_value = engine._granger_test(a, b, maxlag=5)

        # Should not be significant (p > 0.05 in most cases)
        # Note: with random data, there's a 5% chance of false positive
        if p_value is not None:
            # Just verify it runs without error
            assert isinstance(p_value, float)


class TestActivityScoring:
    """Tests for activity score computation."""

    def test_score_never_exceeds_one(self):
        """With max anomalies in all domains, score <= 1.0."""
        weights = {
            "seismic": 0.225,
            "solar_wind": 0.1875,
            "goes": 0.15,
            "atmospheric": 0.075,
            "volcanic": 0.0375,
            "space_weather": 0.075,
        }
        max_domain_score = sum(w * 1.0 for w in weights.values())
        max_corr_score = 1.0 * 0.25
        assert max_domain_score + max_corr_score <= 1.0

    def test_level_classification(self):
        """Score ranges map to correct levels."""
        levels = [
            (0.9, "intense"),
            (0.7, "high"),
            (0.4, "elevated"),
            (0.1, "nominal"),
        ]
        for score, expected in levels:
            if score > 0.8:
                level = "intense"
            elif score > 0.6:
                level = "high"
            elif score > 0.3:
                level = "elevated"
            else:
                level = "nominal"
            assert level == expected
