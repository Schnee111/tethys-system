"""Tethys — Prewhitening with ARIMA.

Before cross-correlation, autocorrelation in each series can induce
spurious cross-correlation. Prewhitening removes the autocorrelation
structure from one series, then correlates the residuals with the other.

More rigorous than simple first-order differencing.

Source: Box & Jenkins (1970) — "Time Series Analysis: Forecasting and Control"
Source: Jenkins & Watts (1968) — "Spectral Analysis and its Applications"
"""

import logging

import numpy as np
from scipy import stats

logger = logging.getLogger(__name__)


def prewhiten(
    series_a: np.ndarray,
    series_b: np.ndarray,
    max_order: int = 5,
) -> tuple[np.ndarray, np.ndarray] | None:
    """Prewhiten series_a using ARIMA, then return residuals and aligned series_b.

    Steps:
    1. Fit AR(p) model to series_a (p selected by AIC)
    2. Compute residuals of series_a
    3. Apply same transformation to series_b
    4. Return (residuals_a, transformed_b)

    Args:
        series_a: First time series (will be prewhitened)
        series_b: Second time series (will be transformed accordingly)
        max_order: Maximum AR order to consider

    Returns:
        Tuple of (prewhitened_a, transformed_b), or None if fitting fails.
    """
    try:
        from statsmodels.tsa.ar_model import AutoReg, ar_select_order

        # Select optimal AR order using AIC
        if len(series_a) < max_order * 3:
            max_order = max(1, len(series_a) // 3)

        # Fit AR model to series_a
        sel = ar_select_order(series_a, maxlag=max_order, ic="aic", trend="n")
        best_order = max(sel.ar_lags) if sel.ar_lags else 1

        model = AutoReg(series_a, lags=best_order, trend="n")
        result = model.fit()

        # Get residuals (prewhitened series_a)
        residuals_a = result.resid

        # Apply same AR filter to series_b
        # Filter series_b with the same AR coefficients
        ar_params = result.params
        transformed_b = _apply_ar_filter(series_b, ar_params)

        # Align lengths (AR(p) loses p observations)
        min_len = min(len(residuals_a), len(transformed_b))
        residuals_a = residuals_a[-min_len:]
        transformed_b = transformed_b[-min_len:]

        return residuals_a, transformed_b

    except Exception as e:
        logger.warning(f"Prewhitening failed: {e}")
        return None


def _apply_ar_filter(series: np.ndarray, ar_params: np.ndarray) -> np.ndarray:
    """Apply AR filter to a series using given parameters."""
    n = len(series)
    order = len(ar_params)
    result = np.zeros(n)

    for t in range(order, n):
        val = series[t]
        for i, param in enumerate(ar_params):
            val -= param * series[t - i - 1]
        result[t] = val

    return result


def prewhiten_and_correlate(
    series_a: np.ndarray,
    series_b: np.ndarray,
) -> dict | None:
    """Prewhiten both series, then compute correlation on residuals.

    Returns:
        Dict with pearson_r, p_value, and prewhitening_order.
        Or None if prewhitening fails.
    """
    result = prewhiten(series_a, series_b)
    if result is None:
        return None

    resid_a, transformed_b = result

    # Filter out NaN/Inf
    valid = np.isfinite(resid_a) & np.isfinite(transformed_b)
    resid_a = resid_a[valid]
    transformed_b = transformed_b[valid]

    if len(resid_a) < 20:
        return None

    try:
        pearson_r, pearson_p = stats.pearsonr(resid_a, transformed_b)
        return {
            "pearson_r": float(pearson_r),
            "p_value": float(pearson_p),
            "sample_size": len(resid_a),
            "method": "prewhitened_arima",
        }
    except ValueError:
        return None
