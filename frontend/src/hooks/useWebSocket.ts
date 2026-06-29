/**
 * TETHYS — WebSocket Live Event Stream Hook
 *
 * Connects to backend /ws/v1/live endpoint.
 * Handles: ping/pong keepalive, sync on connect, reconnection with backoff.
 * Updates Zustand stores directly — no polling needed.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useDataStore } from '../stores/dataStore';
import type { RawSeismicEvent, RawGoesReading, RawSolarWindReading } from '../stores/dataStore';
import type { PlanetaryEvent, Anomaly } from '../types';

// Transform raw DB row → PlanetaryEvent
function transformSeismic(e: any): PlanetaryEvent {
  function toSeverity(mag: number): 'low' | 'medium' | 'high' | 'critical' {
    if (mag >= 6) return 'critical';
    if (mag >= 5) return 'high';
    if (mag >= 4) return 'medium';
    return 'low';
  }
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
    severity: toSeverity(e.magnitude || 0),
    sig: e.sig,
    felt: e.felt,
    alert: e.alert,
    tsunami: e.tsunami,
    eventType: e.type,
  };
}

function transformSolarWind(s: any): PlanetaryEvent {
  return {
    time: s.time,
    event_id: `sw-${s.time}`,
    domain: 'solar_wind',
    title: `Solar Wind — ${s.speed?.toFixed(0) || '?'} km/s`,
    location: 'Heliospheric',
    latitude: 0,
    longitude: 0,
    description: `Speed: ${s.speed?.toFixed(0) || '?'} km/s · Density: ${s.density?.toFixed(1) || '?'} p/cm³`,
    severity: (s.speed || 0) > 600 ? 'high' : (s.speed || 0) > 400 ? 'medium' : 'low',
  };
}

function transformGoes(g: any): PlanetaryEvent {
  const flux = g.flux || 0;
  return {
    time: g.time,
    event_id: `goes-${g.time}`,
    domain: 'goes',
    title: `GOES X-ray — ${flux.toExponential(1)}`,
    location: 'Geostationary Orbit',
    latitude: 0,
    longitude: -75,
    description: `X-ray Flux: ${flux.toExponential(2)} · Satellite: ${g.satellite || '?'}`,
    severity: flux > 1e-4 ? 'critical' : flux > 1e-5 ? 'high' : flux > 1e-6 ? 'medium' : 'low',
  };
}

function transformVolcanic(v: any): PlanetaryEvent {
  return {
    time: v.time,
    event_id: v.event_id,
    domain: 'volcanic',
    title: v.volcano_name || 'Volcanic Event',
    location: v.volcano_name || 'Unknown',
    latitude: v.latitude,
    longitude: v.longitude,
    description: v.description || v.volcano_name || '',
    severity: 'medium' as const,
    elevation_m: v.elevation_m,
    vei: v.vei,
    link: v.link,
  };
}

function transformSpaceWeather(s: any): Anomaly {
  return {
    time: s.time,
    anomaly_id: s.event_id || `sw-${s.time}`,
    domain: 'space_weather',
    metric: s.event_type || 'unknown',
    value: 0,
    z_score: 0,
    severity: 'medium',
    description: `${s.event_type || 'Space Weather'}: ${s.note || s.source || ''}`,
  };
}

// Normalize raw DB rows into chart-ready types
function normalizeRawSeismic(rows: any[]): RawSeismicEvent[] {
  return rows.map(r => ({
    time: r.time,
    event_id: r.event_id,
    magnitude: r.magnitude ?? 0,
    latitude: r.latitude ?? 0,
    longitude: r.longitude ?? 0,
    depth_km: r.depth_km ?? null,
    place: r.place ?? null,
    type: r.type ?? 'earthquake',
    sig: r.sig ?? null,
    felt: r.felt ?? null,
    alert: r.alert ?? null,
    tsunami: r.tsunami ?? 0,
  }));
}

function normalizeRawGoes(rows: any[]): RawGoesReading[] {
  return rows.map(r => ({
    time: r.time,
    flux_type: r.flux_type ?? 'xray',
    energy_band: r.energy_band ?? '0.1-0.8nm',
    flux: r.flux ?? 0,
    satellite: r.satellite ?? 'goes-primary',
  }));
}

function normalizeRawSolarWind(rows: any[]): RawSolarWindReading[] {
  return rows.map(r => ({
    time: r.time,
    data_type: r.data_type ?? (r.speed != null ? 'plasma' : 'mag'),
    density: r.density ?? undefined,
    speed: r.speed ?? undefined,
    temperature: r.temperature ?? undefined,
    bt: r.bt ?? undefined,
    bx_gsm: r.bx_gsm ?? undefined,
    by_gsm: r.by_gsm ?? undefined,
    bz_gsm: r.bz_gsm ?? undefined,
  }));
}

// WebSocket URL — Vite proxies /ws to backend in dev, same origin in prod
function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/v1/live`;
}

// Generate realistic mock data for offline development
function generateMockData() {
  const store = useDataStore.getState();
  
  // 1. Generate Raw Seismic Events (for charts & globe)
  const mockRawSeismic: RawSeismicEvent[] = [];
  const mockEvents: PlanetaryEvent[] = [];
  const now = new Date();
  
  const places = [
    "Fiji Region", "Honshu, Japan", "Southern Sumatra, Indonesia", "Chile-Argentina Border",
    "Kermadec Islands, New Zealand", "Hindu Kush Region, Afghanistan", "Rat Islands, Aleutian Islands",
    "Southern East Pacific Rise", "Banda Sea", "Reykjanes Ridge"
  ];
  
  for (let i = 0; i < 40; i++) {
    const t = new Date(now.getTime() - i * 25 * 60 * 1000); // every 25 mins
    const mag = 2.5 + Math.random() * 4.5;
    const lat = -60 + Math.random() * 120;
    const lon = -180 + Math.random() * 360;
    const depth = 10 + Math.random() * 200;
    const id = `mock-seismic-${i}`;
    const place = places[i % places.length];
    
    mockRawSeismic.push({
      time: t.toISOString(),
      event_id: id,
      magnitude: mag,
      latitude: lat,
      longitude: lon,
      depth_km: depth,
      place: place,
      type: "earthquake",
      sig: Math.round(mag * 100),
      felt: Math.round(Math.random() * 20),
      alert: mag > 6 ? 'yellow' : null,
      tsunami: mag > 6.5 ? 1 : 0
    });
    
    mockEvents.push({
      time: t.toISOString(),
      event_id: id,
      domain: 'seismic',
      title: `M${mag.toFixed(1)} — ${place}`,
      location: place,
      latitude: lat,
      longitude: lon,
      magnitude: mag,
      depth_km: depth,
      description: `Depth: ${depth.toFixed(1)}km · Sig: ${Math.round(mag * 100)}`,
      severity: mag >= 6 ? 'critical' : mag >= 5 ? 'high' : mag >= 4 ? 'medium' : 'low',
    });
  }
  
  // 2. Generate Volcanic Events
  const volcanoNames = ["Mount Etna, Italy", "Sakurajima, Japan", "Kilauea, Hawaii", "Stromboli, Italy", "Popocatépetl, Mexico"];
  const volcanoCoords = [
    { lat: 37.75, lon: 15.00 },
    { lat: 31.58, lon: 130.65 },
    { lat: 19.42, lon: -155.28 },
    { lat: 38.79, lon: 15.21 },
    { lat: 19.02, lon: -98.62 }
  ];
  
  for (let i = 0; i < volcanoNames.length; i++) {
    const t = new Date(now.getTime() - i * 3 * 3600 * 1000);
    const id = `mock-volcano-${i}`;
    mockEvents.push({
      time: t.toISOString(),
      event_id: id,
      domain: 'volcanic',
      title: volcanoNames[i],
      location: volcanoNames[i],
      latitude: volcanoCoords[i].lat,
      longitude: volcanoCoords[i].lon,
      description: `Active volcanic eruption detected at ${volcanoNames[i]}. Muted seismic tremor registered.`,
      severity: 'medium',
    });
  }
  
  // 3. Generate Solar Wind Readings
  const mockRawSolarWind: RawSolarWindReading[] = [];
  for (let i = 0; i < 50; i++) {
    const t = new Date(now.getTime() - i * 30 * 60 * 1000);
    const speed = 350 + Math.random() * 300;
    const density = 3 + Math.random() * 15;
    const bt = 4 + Math.random() * 8;
    const bz_gsm = -6 + Math.random() * 12;
    
    mockRawSolarWind.push({
      time: t.toISOString(),
      data_type: 'plasma',
      speed,
      density,
      temperature: 50000 + Math.random() * 100000
    });
    mockRawSolarWind.push({
      time: t.toISOString(),
      data_type: 'mag',
      bt,
      bz_gsm,
      bx_gsm: -2 + Math.random() * 4,
      by_gsm: -2 + Math.random() * 4
    });
    
    if (i % 5 === 0) {
      mockEvents.push({
        time: t.toISOString(),
        event_id: `mock-sw-${i}`,
        domain: 'solar_wind',
        title: `Solar Wind — ${speed.toFixed(0)} km/s`,
        location: 'Heliospheric',
        latitude: 0,
        longitude: 0,
        description: `Speed: ${speed.toFixed(0)} km/s · Density: ${density.toFixed(1)} p/cm³`,
        severity: speed > 600 ? 'high' : speed > 400 ? 'medium' : 'low',
      });
    }
  }
  
  // 4. Generate GOES Readings
  const mockRawGoes: RawGoesReading[] = [];
  for (let i = 0; i < 50; i++) {
    const t = new Date(now.getTime() - i * 15 * 60 * 1000);
    const flux = 1e-8 + Math.random() * 2e-5;
    mockRawGoes.push({
      time: t.toISOString(),
      flux_type: 'xray',
      energy_band: '0.1-0.8nm',
      flux,
      satellite: 'goes-16'
    });
    
    if (i % 6 === 0) {
      mockEvents.push({
        time: t.toISOString(),
        event_id: `mock-goes-${i}`,
        domain: 'goes',
        title: `GOES X-ray — ${flux.toExponential(1)}`,
        location: 'Geostationary Orbit',
        latitude: 0,
        longitude: -75,
        description: `X-ray Flux: ${flux.toExponential(2)} · Satellite: goes-16`,
        severity: flux > 1e-4 ? 'critical' : flux > 1e-5 ? 'high' : flux > 1e-6 ? 'medium' : 'low',
      });
    }
  }

  // 5. Generate Anomalies
  const mockAnomalies = [
    {
      time: now.toISOString(),
      anomaly_id: "mock-anom-1",
      domain: "seismic",
      metric: "magnitude",
      value: 7.2,
      z_score: 4.8,
      severity: "high",
      description: "M7.2 earthquake anomaly detected"
    },
    {
      time: new Date(now.getTime() - 2 * 3600000).toISOString(),
      anomaly_id: "mock-anom-2",
      domain: "solar_wind",
      metric: "avg_speed",
      value: 650,
      z_score: 3.9,
      severity: "medium",
      description: "Solar wind speed spike: 650 km/s"
    }
  ] as const as Anomaly[];

  // Set standard status
  store.setStatus({
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
  });

  store.setEvents(mockEvents);
  store.setRawSeismic(mockRawSeismic);
  store.setRawSolarWind(mockRawSolarWind);
  store.setRawGoes(mockRawGoes);
  store.setAnomalies(mockAnomalies);
}

interface UseWebSocketOptions {
  enabled?: boolean;
  reconnectInterval?: number;  // base reconnect delay (ms)
  maxReconnectAttempts?: number;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    enabled = true,
    reconnectInterval = 2000,
    maxReconnectAttempts = 5,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pingTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const isMounted = useRef(true);

  const setWsConnected = useDataStore(s => s.setWsConnected);
  const setEvents = useDataStore(s => s.setEvents);
  const addEvents = useDataStore(s => s.addEvents);

  // Raw data store actions
  const setRawSeismic = useDataStore(s => s.setRawSeismic);
  const setRawGoes = useDataStore(s => s.setRawGoes);
  const setRawSolarWind = useDataStore(s => s.setRawSolarWind);
  const addRawSeismic = useDataStore(s => s.addRawSeismic);
  const addRawGoes = useDataStore(s => s.addRawGoes);
  const addRawSolarWind = useDataStore(s => s.addRawSolarWind);

  const connect = useCallback(() => {
    if (!isMounted.current || !enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to', url);
      setWsConnected(true);
      reconnectAttempt.current = 0;

      // Request last 24h of data on connect
      ws.send(JSON.stringify({ type: 'sync_request' }));

      // Start ping interval (browser can't send protocol pings)
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      }, 25000); // Slightly under the 30s server ping
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'ping': {
            // Server heartbeat — respond with pong
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          }

          case 'sync_response': {
            // Bulk data on connect — replace all events + raw chart data
            const data = msg.data || {};
            const allEvents: PlanetaryEvent[] = [];

            if (data.seismic) {
              allEvents.push(...data.seismic.map(transformSeismic));
              setRawSeismic(normalizeRawSeismic(data.seismic));
            }
            if (data.solar_wind) {
              allEvents.push(...data.solar_wind.map(transformSolarWind));
              setRawSolarWind(normalizeRawSolarWind(data.solar_wind));
            }
            if (data.goes) {
              allEvents.push(...data.goes.map(transformGoes));
              setRawGoes(normalizeRawGoes(data.goes));
            }
            if (data.volcanic) {
              allEvents.push(...data.volcanic.map(transformVolcanic));
            }

            setEvents(allEvents);

            console.log(`[WS] Sync: ${allEvents.length} events loaded`);
            break;
          }

          case 'seismic': {
            const records = msg.data || [];
            addEvents(records.map(transformSeismic));
            addRawSeismic(normalizeRawSeismic(records));
            break;
          }

          case 'solar_wind': {
            const records = msg.data || [];
            addEvents(records.map(transformSolarWind));
            addRawSolarWind(normalizeRawSolarWind(records));
            break;
          }

          case 'goes_flux': {
            // Backend collector name is "goes_flux" (from GOESFluxCollector.name)
            const records = msg.data || [];
            addEvents(records.map(transformGoes));
            addRawGoes(normalizeRawGoes(records));
            break;
          }

          case 'goes': {
            // Fallback for older backend or alternate naming
            const records = msg.data || [];
            addEvents(records.map(transformGoes));
            addRawGoes(normalizeRawGoes(records));
            break;
          }

          case 'volcanic': {
            const records = msg.data || [];
            addEvents(records.map(transformVolcanic));
            break;
          }

          default:
            console.log('[WS] Unknown message type:', msg.type);
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log('[WS] Disconnected:', event.code, event.reason);
      setWsConnected(false);
      clearInterval(pingTimer.current);

      // Auto-reconnect with exponential backoff
      if (isMounted.current && reconnectAttempt.current < maxReconnectAttempts) {
        const delay = Math.min(
          reconnectInterval * Math.pow(1.5, reconnectAttempt.current),
          30000 // Max 30s between retries
        );
        console.log(`[WS] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectAttempt.current + 1}/${maxReconnectAttempts})`);
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      } else if (reconnectAttempt.current >= maxReconnectAttempts) {
        console.warn(`[WS] Reconnection stopped after ${maxReconnectAttempts} failed attempts. Running in offline/demo mode.`);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      // Generate realistic mock data when offline to prevent empty interface
      const currentEvents = useDataStore.getState().events;
      if (currentEvents.length === 0) {
        console.log('[WS] Connection failed. Populating mock data for development...');
        generateMockData();
      }
    };
  }, [enabled, reconnectInterval, maxReconnectAttempts, setWsConnected, setEvents, addEvents, setRawSeismic, setRawGoes, setRawSolarWind, addRawSeismic, addRawGoes, addRawSolarWind]);

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      clearTimeout(reconnectTimer.current);
      clearInterval(pingTimer.current);
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [connect]);

  // Expose connection state and manual reconnect
  return {
    isConnected: useDataStore(s => s.wsConnected),
    reconnect: () => {
      reconnectAttempt.current = 0;
      wsRef.current?.close();
      connect();
    },
  };
}
