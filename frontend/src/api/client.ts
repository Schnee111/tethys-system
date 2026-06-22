import axios from 'axios';
import type { PlanetaryEvent, Anomaly } from '../types';

const client = axios.create({ baseURL: '', timeout: 10000 });

function toSeverity(mag: number): 'low' | 'medium' | 'high' | 'critical' {
  if (mag >= 6) return 'critical';
  if (mag >= 5) return 'high';
  if (mag >= 4) return 'medium';
  return 'low';
}

function transformSeismic(e: any): PlanetaryEvent {
  return {
    time: e.time,
    event_id: e.event_id,
    domain: 'seismic',
    title: `M${e.magnitude?.toFixed(1) || '?'} — ${e.place || 'Unknown'}`,
    location: e.place || 'Unknown',
    latitude: e.latitude,
    longitude: e.longitude,
    magnitude: e.magnitude,
    depth_km: e.depth_km,
    description: `Depth: ${e.depth_km?.toFixed(1) || '?'}km · Sig: ${e.sig || '-'}`,
    severity: toSeverity(e.magnitude),
  };
}

function transformAnomaly(a: any): Anomaly {
  return {
    time: a.time,
    anomaly_id: a.anomaly_id,
    domain: a.domain,
    metric: a.metric,
    value: a.value,
    z_score: a.z_score,
    severity: a.severity,
    description: `${a.metric}: ${a.value?.toFixed(2)} (z=${a.z_score?.toFixed(1)})`,
  };
}

export const api = {
  getStatus: () => client.get('/api/v1/status').then(r => r.data),
  getSeismic: async (params?: { hours?: number; min_mag?: number; limit?: number }) => {
    const { data } = await client.get('/api/v1/events/seismic', { params });
    return { count: data.count, events: (data.events || []).map(transformSeismic) };
  },
  getAnomalies: async (params?: { hours?: number; domain?: string; severity?: string }) => {
    const { data } = await client.get('/api/v1/anomalies', { params });
    return { count: data.count, anomalies: (data.anomalies || []).map(transformAnomaly) };
  },
  getActivity: () => client.get('/api/v1/activity').then(r => r.data),
  getSolarWindLatest: () => client.get('/api/v1/solar-wind/latest').then(r => r.data),
  getGoesXray: (params?: { hours?: number }) => client.get('/api/v1/goes/xray', { params }).then(r => r.data),
  getVolcanic: () => client.get('/api/v1/volcanic').then(r => r.data),
  getAtmospheric: () => client.get('/api/v1/atmospheric').then(r => r.data),
  getSpaceWeather: () => client.get('/api/v1/space-weather').then(r => r.data),
};
