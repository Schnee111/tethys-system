"""Tethys — Wavelet Coherence Analysis.

Time-frequency resolved correlation. Shows if correlation exists at
specific periodicities (diurnal, 27-day, annual) and how it changes
over time. Addresses non-stationarity more elegantly than differencing.

Source: Grinsted et al. (2004) "Application of the cross wavelet transform
and wavelet coherence to geophysical time series"
Library: pycwt (Python)
"""

import logging

import numpy as np

logger = logging.getLogger(__name__)


def wavelet_coherence(
    series_a: np.ndarray,
    series_b: np.ndarray,
    dt: float = 1.0,
    wavelet: str = "morlet",
    significance_level: float = 0.95,
) -> dict | None:
    """Compute wavelet coherence between two time series.

    Args:
        series_a: First time series (e.g., solar wind speed)
        series_b: Second time series (e.g., seismic energy)
        dt: Time step between samples (in hours)
        wavelet: Wavelet type ('morlet', 'dog', 'paul')
        significance_level: Significance level for coherence (default 0.95)

    Returns:
        Dict with:
        - coherence: 2D array (time x frequency) of coherence values
        - period: Array of periods (in hours)
        - coi: Cone of influence
        - significant: Boolean mask of significant coherence
        - max_coherence: Maximum coherence value
        - dominant_period: Period of maximum coherence (hours)
        Or None if computation fails.
    """
    try:
        import pycwt

        # Normalize series
        a = (series_a - np.nanmean(series_a)) / np.nanstd(series_a)
        b = (series_b - np.nanmean(series_b)) / np.nanstd(series_b)

        # Fill NaN with interpolation
        a = _fill_nan(a)
        b = _fill_nan(b)

        if len(a) < 20 or len(b) < 20:
            return None

        # Mother wavelet
        if wavelet == "morlet":
            mother = pycwt.Morlet(6)
        elif wavelet == "dog":
            mother = pycwt.DOG(2)
        elif wavelet == "paul":
            mother = pycwt.Paul(4)
        else:
            mother = pycwt.Morlet(6)

        # Wavelet transform
        s0 = 2 * dt  # Smallest scale
        dj = 1 / 12  # Number of sub-octaves
        J = 7 / dj  # Number of scales

        W_a, scales, freqs, coi_a, _, _ = pycwt.cwt(a, dt, dj, s0, J, mother)
        W_b, _, _, _, _, _ = pycwt.cwt(b, dt, dj, s0, J, mother)

        # Cross-wavelet spectrum
        W_ab = W_a * np.conj(W_b)

        # Smoothed cross-wavelet and auto-wavelet
        smooth = _smooth_kernel(mother, dt, scales)

        S_ab = _smooth_spectrum(W_ab, smooth)
        S_aa = _smooth_spectrum(W_a * np.conj(W_a), smooth)
        S_bb = _smooth_spectrum(W_b * np.conj(W_b), smooth)

        # Wavelet coherence
        coherence = np.abs(S_ab) ** 2 / (S_aa * S_bb + 1e-10)

        # Period in hours
        period = 1.0 / freqs

        # Cone of influence
        coi = coi_a

        # Significance (approximate — chi-squared test)
        # For Morlet wavelet, degrees of freedom ≈ 2
        dof = 2
        from scipy import stats as sp_stats

        signif = sp_stats.chi2.ppf(significance_level, dof) / dof
        significant = coherence > signif

        # Find dominant period (highest mean coherence)
        mean_coherence = np.mean(coherence, axis=1)
        dominant_idx = np.argmax(mean_coherence)

        return {
            "coherence": coherence,
            "period": period,
            "coi": coi,
            "significant": significant,
            "max_coherence": float(np.nanmax(np.real(coherence))),
            "dominant_period": float(period[dominant_idx]),
            "dominant_coherence": float(np.real(mean_coherence[dominant_idx])),
        }

    except Exception as e:
        logger.warning(f"Wavelet coherence computation failed: {e}")
        return None


def _fill_nan(data: np.ndarray) -> np.ndarray:
    """Fill NaN values with linear interpolation."""
    mask = np.isnan(data)
    if not np.any(mask):
        return data
    data[mask] = np.interp(
        np.where(mask)[0],
        np.where(~mask)[0],
        data[~mask],
    )
    return data


def _smooth_kernel(mother, dt, scales):
    """Create smoothing kernel for wavelet coherence."""
    # Simplified smoothing — Gaussian in time and frequency
    nt = 10  # smoothing window size
    return np.ones((nt, nt)) / (nt * nt)


def _smooth_spectrum(spectrum, kernel):
    """Apply smoothing to wavelet spectrum."""
    from scipy.ndimage import convolve

    # Smooth real and imaginary parts separately
    real_smooth = convolve(np.real(spectrum), kernel, mode="constant")
    imag_smooth = convolve(np.imag(spectrum), kernel, mode="constant")

    return real_smooth + 1j * imag_smooth
