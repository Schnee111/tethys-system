export type EventCategory = 'seismic' | 'solar_wind' | 'goes' | 'atmospheric' | 'volcanic' | 'space_weather';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type ActivityLevel = 'nominal' | 'elevated' | 'high' | 'intense';

export interface PlanetaryEvent {
  time: string;
  event_id: string;
  domain: EventCategory;
  title: string;
  location: string;
  latitude: number;
  longitude: number;
  magnitude?: number;
  depth_km?: number;
  description: string;
  severity: Severity;
  // Seismic-specific (optional)
  sig?: number;        // USGS significance score
  felt?: number;        // Number of "felt" reports
  alert?: string;       // USGS alert level: green/yellow/orange/red
  tsunami?: number;     // 1 = tsunami warning issued
  eventType?: string;   // earthquake, etc.
  // Volcanic-specific (optional)
  elevation_m?: number;
  vei?: number;          // Volcanic Explosivity Index
  link?: string;         // Source link
}

export interface Anomaly {
  time: string;
  anomaly_id: string;
  domain: EventCategory;
  metric: string;
  value: number;
  z_score: number;
  severity: Severity;
  description: string;
}

export interface ActivityAssessment {
  time: string;
  activity_level: ActivityLevel;
  activity_score: number;
  confidence: number;
  coverage: string;
  active_anomalies: number;
  active_correlations: number;
  domains_affected: string[];
  summary: string;
}

export interface Correlation {
  time: string;
  correlation_id: string;
  domain_a: string;
  metric_a: string;
  domain_b: string;
  metric_b: string;
  window_hours: number;
  lag_hours: number;
  pearson_r: number;
  spearman_rho: number;
  p_value: number;
  p_value_corrected: number | null;
  fdr_method: string | null;
  sample_size: number;
  is_significant: boolean;
  granger_p: number | null;
  granger_causal: boolean | null;
}

export interface Narrative {
  text: string;
  narrative_type: string;
  severity: string;
  timestamp: string;
  activity_level: string;
  active_anomalies: number;
  domains_affected: string[];
}

export interface SystemStatus {
  status: string;
  version: string;
  uptime_seconds: number;
  environment: string;
  collectors: Record<string, {
    status: string;
    last_poll: string;
    records: number;
    latency_ms: number;
    error: string | null;
  }>;
  database: {
    tables: Record<string, number>;
    total_records: number;
    size: string;
  };
}
