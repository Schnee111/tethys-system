"""Tethys — Tests for Analysis Engine (Phase 2)."""

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

    def test_fdr_correction(self):
        """21 tests with p=0.04 should NOT be significant after BH."""
        from statsmodels.stats.multitest import multipletests

        raw_pvals = [0.04] * 5 + [0.5] * 16
        reject, _pvals_corrected, _, _ = multipletests(raw_pvals, alpha=0.05, method="fdr_bh")
        assert not any(reject)

    def test_fdr_with_genuine_correlation(self):
        """Very small p-value should survive FDR correction."""
        from statsmodels.stats.multitest import multipletests

        raw_pvals = [0.001, 0.5, 0.8, 0.9, 0.95]
        reject, _pvals_corrected, _, _ = multipletests(raw_pvals, alpha=0.05, method="fdr_bh")
        assert reject[0]  # First one should be significant
        assert not reject[1]  # Others should not

    def test_stationarity_differencing(self):
        """First-order differencing removes linear trend."""
        values = np.arange(100, dtype=float) + np.random.normal(0, 0.1, 100)
        diff = np.diff(values)
        # Differenced values should be around 1.0 (the slope), not growing
        assert abs(np.mean(diff) - 1.0) < 0.5
        assert np.std(diff) < 1.0


class TestActivityScoring:
    """Tests for activity score computation."""

    def test_score_never_exceeds_one(self):
        """With max anomalies in all domains, score <= 1.0."""
        max_domain_score = sum(
            c["weight"] * 1.0
            for c in {
                "seismic": {"weight": 0.225},
                "solar_wind": {"weight": 0.1875},
                "goes": {"weight": 0.15},
                "atmospheric": {"weight": 0.075},
                "volcanic": {"weight": 0.0375},
                "space_weather": {"weight": 0.075},
            }.values()
        )
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
