export type EventCategory = 'seismic' | 'solar' | 'atmospheric';

export interface PlanetaryEvent {
  id: string;
  type: EventCategory;
  timestamp: string; // HH:MM:SS
  originalTime: string; // Dynamic simulated time
  magnitude: string;
  title: string; // e.g. "M 4.2", "C-Class Flare Detected", "Pressure Drop 12hPa"
  location: string;
  x: number; // 0 to 100 on visual grid
  y: number; // 0 to 100 on visual grid
  intensity: number; // 0 to 1
  minutesAgo: number; // For timeline filtering (0 to 720 minutes, which is 12 hours)
  description: string;
}

export interface Metric {
  label: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'stable';
}

export interface ChartDataPoint {
  timeLabel: string;
  seismic: number;
  solar: number;
  atmospheric: number;
}
