import axios from 'axios';
import type { PlanetaryEvent, Anomaly } from '../types';

const client = axios.create({ baseURL: '', timeout: 10000 });

// Interceptor to return mock data if backend is offline
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // If it's a network error (server is offline), return mock data for development
    if (!error.response || error.code === 'ERR_NETWORK') {
      const url = error.config.url || '';
      console.warn(`[API Client] Connection to backend failed. Serving mock data for: ${url}`);
      
      const now = new Date();
      let mockData: any = null;

      if (url.includes('/api/v1/status')) {
        mockData = {
          status: "offline_mock",
          version: "0.1.0-mock",
          uptime_seconds: 3600,
          environment: "development",
          collectors: {
            seismic: { status: "ok", last_poll: now.toISOString(), records: 40, latency_ms: 120, error: null },
            solar_wind: { status: "ok", last_poll: now.toISOString(), records: 100, latency_ms: 80, error: null },
            goes: { status: "ok", last_poll: now.toISOString(), records: 50, latency_ms: 90, error: null }
          },
          database: {
            tables: { seismic_events: 40, solar_wind: 100, goes_flux: 50 },
            total_records: 190,
            size: "1.2 MB"
          }
        };
      } else if (url.includes('/api/v1/events/seismic')) {
        mockData = {
          count: 2,
          events: [
            {
              time: new Date(now.getTime() - 15 * 60000).toISOString(),
              event_id: "mock-seismic-api-1",
              magnitude: 5.8,
              latitude: 35.6762,
              longitude: 139.6503,
              depth_km: 24.5,
              place: "Honshu, Japan",
              type: "earthquake",
              sig: 580,
              felt: 42,
              alert: "green",
              tsunami: 0
            },
            {
              time: new Date(now.getTime() - 45 * 60000).toISOString(),
              event_id: "mock-seismic-api-2",
              magnitude: 6.2,
              latitude: -18.232,
              longitude: -178.118,
              depth_km: 560.1,
              place: "Fiji Region",
              type: "earthquake",
              sig: 620,
              felt: 0,
              alert: "yellow",
              tsunami: 0
            }
          ]
        };
      } else if (url.includes('/api/v1/anomalies')) {
        mockData = {
          count: 2,
          anomalies: [
            {
              time: now.toISOString(),
              anomaly_id: "mock-anom-1",
              domain: "seismic",
              metric: "magnitude",
              value: 7.2,
              z_score: 4.8,
              severity: "high"
            },
            {
              time: new Date(now.getTime() - 2 * 3600000).toISOString(),
              anomaly_id: "mock-anom-2",
              domain: "solar_wind",
              metric: "speed",
              value: 650,
              z_score: 3.9,
              severity: "medium"
            }
          ]
        };
      } else if (url.includes('/api/v1/activity')) {
        mockData = {
          activity_level: "elevated",
          activity_score: 64.2
        };
      } else if (url.includes('/api/v1/solar-wind/latest')) {
        mockData = {
          speed: 485.2,
          density: 6.8,
          temperature: 85000.0,
          bz_gsm: -2.4,
          bt: 7.5
        };
      } else if (url.includes('/api/v1/solar-wind/history')) {
        mockData = [];
        for (let i = 0; i < 20; i++) {
          mockData.push({
            time: new Date(now.getTime() - i * 30 * 60 * 1000).toISOString(),
            speed: 400 + Math.random() * 150,
            density: 5 + Math.random() * 5
          });
        }
      } else if (url.includes('/api/v1/goes/xray')) {
        mockData = {
          count: 5,
          readings: [
            {
              time: now.toISOString(),
              flux_type: "xray",
              energy_band: "0.1-0.8nm",
              flux: 1.8e-6,
              satellite: "goes-16"
            },
            {
              time: new Date(now.getTime() - 10 * 60000).toISOString(),
              flux_type: "xray",
              energy_band: "0.05-0.4nm",
              flux: 2.4e-7,
              satellite: "goes-16"
            }
          ]
        };
      } else if (url.includes('/api/v1/volcanic')) {
        mockData = {
          count: 1,
          events: [
            {
              time: new Date(now.getTime() - 3 * 3600 * 1000).toISOString(),
              event_id: "mock-volc-api-1",
              volcano_name: "Mount Etna, Italy",
              latitude: 37.75,
              longitude: 15.00,
              description: "Ash plume rising to 12,000 ft. Strombolian activity continues at Southeast Crater.",
              elevation_m: 3326,
              vei: 2,
              link: "https://volcano.si.edu/"
            }
          ]
        };
      } else if (url.includes('/api/v1/atmospheric')) {
        mockData = {
          count: 5,
          readings: [
            { time: now.toISOString(), location_name: "Tokyo, Japan", latitude: 35.6762, longitude: 139.6503, category: "temperature", temperature: 24.5, temp_min: 18.0, precipitation: 0, wind_speed: 4.2, wind_dir: 180 },
            { time: now.toISOString(), location_name: "Reykjavik, Iceland", latitude: 64.1466, longitude: -21.9426, category: "temperature", temperature: 11.2, temp_min: 8.0, precipitation: 1.2, wind_speed: 8.5, wind_dir: 90 },
            { time: now.toISOString(), location_name: "Naples, Italy", latitude: 40.8518, longitude: 14.2681, category: "temperature", temperature: 28.1, temp_min: 22.0, precipitation: 0, wind_speed: 3.1, wind_dir: 240 },
            { time: now.toISOString(), location_name: "Honolulu, Hawaii", latitude: 21.3069, longitude: -157.8583, category: "temperature", temperature: 27.8, temp_min: 24.0, precipitation: 0.5, wind_speed: 6.7, wind_dir: 70 },
            { time: now.toISOString(), location_name: "Valparaíso, Chile", latitude: -33.0472, longitude: -71.6127, category: "temperature", temperature: 14.2, temp_min: 10.0, precipitation: 0, wind_speed: 5.4, wind_dir: 210 }
          ]
        };
      } else if (url.includes('/api/v1/space-weather')) {
        mockData = {
          events: [
            {
              time: new Date(now.getTime() - 2 * 3600000).toISOString(),
              event_id: "mock-cme-api-1",
              event_type: "CME",
              source: "LASCO C2",
              description: "Halo Coronal Mass Ejection detected. Speed: 820 km/s. Earth-directed component under analysis.",
              link: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/"
            },
            {
              time: new Date(now.getTime() - 5 * 3600000).toISOString(),
              event_id: "mock-flare-api-1",
              event_type: "FLARE",
              source: "GOES-16",
              description: "M3.4 Solar Flare erupted from Active Region 3285. Associated with minor radio blackout.",
              link: "https://kauai.ccmc.gsfc.nasa.gov/DONKI/"
            }
          ]
        };
      }

      if (mockData) {
        return Promise.resolve({
          data: mockData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: error.config,
        });
      }
    }
    return Promise.reject(error);
  }
);

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
    sig: e.sig,
    felt: e.felt,
    alert: e.alert,
    tsunami: e.tsunami,
    eventType: e.type,
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
  getStatus: async () => {
    try {
      return await client.get('/api/v1/status').then(r => r.data);
    } catch {
      return { active_alerts: 0, systems_online: 0, network_load: 0, last_updated: new Date().toISOString() };
    }
  },
  getSeismic: async (params?: { hours?: number; min_mag?: number; limit?: number }) => {
    try {
      const { data } = await client.get('/api/v1/events/seismic', { params });
      return { count: data.count, events: (data.events || []).map(transformSeismic) };
    } catch {
      return { count: 0, events: [] };
    }
  },
  getAnomalies: async (params?: { hours?: number; domain?: string; severity?: string }) => {
    try {
      const { data } = await client.get('/api/v1/anomalies', { params });
      return { count: data.count, anomalies: (data.anomalies || []).map(transformAnomaly) };
    } catch {
      return { count: 0, anomalies: [] };
    }
  },
  getActivity: async () => {
    try {
      return await client.get('/api/v1/activity').then(r => r.data);
    } catch {
      return { activity_level: "unknown", activity_score: 0 };
    }
  },
  getNarrative: async () => {
    try {
      return await client.get('/api/v1/narrative').then(r => r.data);
    } catch {
      return { text: "", narrative_type: "unknown", severity: "low" };
    }
  },
  getCorrelations: async (params?: { hours?: number; significant_only?: boolean }) => {
    try {
      const { data } = await client.get('/api/v1/correlations', { params });
      return { count: data.count, correlations: (data.correlations || []) };
    } catch {
      return { count: 0, correlations: [] };
    }
  },
  getSolarWindLatest: async () => {
    try {
      return await client.get('/api/v1/solar-wind/latest').then(r => r.data);
    } catch {
      return { speed: 0, density: 0, temperature: 0, bz_gsm: 0, bt: 0 };
    }
  },
  getSolarWindHistory: async (params?: { hours?: number }) => {
    try {
      return await client.get('/api/v1/solar-wind/history', { params }).then(r => r.data);
    } catch {
      return [];
    }
  },
  getGoesXray: async (params?: { hours?: number }) => {
    try {
      return await client.get('/api/v1/goes/xray', { params }).then(r => r.data);
    } catch {
      return { count: 0, readings: [] };
    }
  },
  getVolcanic: async () => {
    try {
      return await client.get('/api/v1/volcanic').then(r => r.data);
    } catch {
      return { count: 0, events: [] };
    }
  },
  getAtmospheric: async (params?: { hours?: number }) => {
    try {
      return await client.get('/api/v1/atmospheric', { params }).then(r => r.data);
    } catch {
      return { count: 0, readings: [] };
    }
  },
  getSpaceWeather: async () => {
    try {
      return await client.get('/api/v1/space-weather').then(r => r.data);
    } catch {
      return { events: [] };
    }
  },
};
