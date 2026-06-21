"""Tethys — Transfer Entropy Analysis.

Information-theoretic analog of Granger causality.
Captures NONLINEAR relationships — critical for solar-seismic coupling
where Granger's linearity assumption may miss real signals.

Source: Schreiber (2000) "Measuring information transfer"
Library: PyInform (Python wrapper for inform C library)

Transfer Entropy measures directed information flow from X to Y:
    TE(X→Y) = Σ p(y_{t+1}, y_t^(k), x_t^(l)) *
              log [p(y_{t+1}|y_t^(k),x_t^(l)) / p(y_{t+1}|y_t^(k))]

where k,l are embedding dimensions for Y and X history.
"""

import logging

import numpy as np

logger = logging.getLogger(__name__)


def transfer_entropy(
    source: np.ndarray,
    target: np.ndarray,
    k: int = 1,
    src_lag: int = 1,
    num_bins: int = 8,
) -> float | None:
    """Compute Transfer Entropy from source to target.

    Args:
        source: Source time series (X — the potential cause)
        target: Target time series (Y — the potential effect)
        k: Embedding dimension for target history
        l: Embedding dimension for source history
        num_bins: Number of bins for probability estimation

    Returns:
        Transfer entropy value (bits), or None if computation fails.
        Higher values = more information flow from source to target.
    """
    try:
        from pyinform.transferentropy import transfer_entropy as te_func

        # Discretize continuous data into bins
        source_binned = _discretize(source, num_bins)
        target_binned = _discretize(target, num_bins)

        # PyInform expects integer arrays
        result = te_func(source_binned, target_binned, k=k)
        return float(result)
    except Exception as e:
        logger.warning(f"Transfer entropy computation failed: {e}")
        return None


def _discretize(data: np.ndarray, num_bins: int) -> np.ndarray:
    """Discretize continuous data into integer bins.

    Uses quantile-based binning for equal-frequency bins.
    """
    # Use percentile-based edges for equal-frequency binning
    edges = np.percentile(data[np.isfinite(data)], np.linspace(0, 100, num_bins + 1))
    edges[0] = -np.inf
    edges[-1] = np.inf

    # Digitize: assign each value to a bin
    binned = np.digitize(data, edges) - 1
    binned = np.clip(binned, 0, num_bins - 1)

    return binned.astype(np.int32)


def compute_te_both_directions(
    series_a: np.ndarray,
    series_b: np.ndarray,
    k: int = 1,
    src_lag: int = 1,
    num_bins: int = 8,
) -> dict:
    """Compute Transfer Entropy in both directions.

    Returns:
        Dict with te_a_to_b and te_b_to_a values.
        If te_a_to_b > te_b_to_a, information flows A → B.
    """
    te_a_to_b = transfer_entropy(series_a, series_b, k=k, src_lag=src_lag, num_bins=num_bins)
    te_b_to_a = transfer_entropy(series_b, series_a, k=k, src_lag=src_lag, num_bins=num_bins)

    return {
        "te_a_to_b": te_a_to_b,
        "te_b_to_a": te_b_to_a,
        "direction": "a_to_b" if (te_a_to_b or 0) > (te_b_to_a or 0) else "b_to_a",
        "asymmetry": abs((te_a_to_b or 0) - (te_b_to_a or 0)),
    }
