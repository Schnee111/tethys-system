/**
 * TETHYS — Color System
 *
 * Based on USGS MMI (Modified Mercalli Intensity) conventions:
 * - Cool colors (blue/gray) for minor events
 * - Warm colors (yellow/orange) for moderate events
 * - Red ONLY for significant/dangerous events (M5+)
 *
 * This prevents alarm fatigue — red means "pay attention", not "normal".
 */

// Magnitude → color (USGS-inspired graduated scale)
export function magnitudeColor(mag: number): string {
  if (mag >= 6) return '#dc2626';  // dark red — major, destructive
  if (mag >= 5) return '#ef4444';  // red — significant, felt widely
  if (mag >= 4) return '#f59e0b';  // amber — moderate, notable
  if (mag >= 3) return '#eab308';  // yellow — minor, felt locally
  if (mag >= 2) return '#22c55e';  // green — micro, rarely felt
  return '#6b7280';                // gray — minor, not felt
}

// Magnitude → human-readable severity label
export function magnitudeLabel(mag: number): string {
  if (mag >= 6) return 'Major';
  if (mag >= 5) return 'Significant';
  if (mag >= 4) return 'Moderate';
  if (mag >= 3) return 'Minor';
  if (mag >= 2) return 'Micro';
  return 'Minor';
}

// Domain → color (consistent across all components)
export const DOMAIN_COLORS: Record<string, string> = {
  seismic: '#f87171',
  solar_wind: '#fbbf24',
  goes: '#a78bfa',
  atmospheric: '#60a5fa',
  volcanic: '#fb923c',
  space_weather: '#34d399',
};

// Severity → color (for anomalies, alerts)
export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#dc2626';
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'low': return '#6b7280';
    default: return '#6b7280';
  }
}
