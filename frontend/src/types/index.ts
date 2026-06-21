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
