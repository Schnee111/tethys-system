import axios from 'axios';

// Use relative URLs — Vite proxy handles forwarding to backend
// This avoids CORS issues and works in both dev and production
const client = axios.create({
  baseURL: '',
  timeout: 10000,
});

export const api = {
  getStatus: () => client.get('/api/v1/status').then(r => r.data),
  getSeismic: (params?: { hours?: number; min_mag?: number; limit?: number }) =>
    client.get('/api/v1/events/seismic', { params }).then(r => r.data),
  getSolarWindLatest: () => client.get('/api/v1/solar-wind/latest').then(r => r.data),
  getGoesXray: (params?: { hours?: number }) =>
    client.get('/api/v1/goes/xray', { params }).then(r => r.data),
  getSpaceWeather: (params?: { hours?: number; event_type?: string }) =>
    client.get('/api/v1/space-weather', { params }).then(r => r.data),
  getVolcanic: (params?: { days?: number }) =>
    client.get('/api/v1/volcanic', { params }).then(r => r.data),
  getAnomalies: (params?: { hours?: number; domain?: string; severity?: string }) =>
    client.get('/api/v1/anomalies', { params }).then(r => r.data),
  getCorrelations: (params?: { hours?: number; significant_only?: boolean }) =>
    client.get('/api/v1/correlations', { params }).then(r => r.data),
  getActivity: () => client.get('/api/v1/activity').then(r => r.data),
};
