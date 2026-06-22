/**
 * TETHYS — WebSocket Live Event Stream Hook
 *
 * Connects to backend /ws/v1/live endpoint.
 * Handles: ping/pong keepalive, sync on connect, reconnection with backoff.
 * Updates Zustand stores directly — no polling needed.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';
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

// WebSocket URL — Vite proxies /ws to backend in dev, same origin in prod
function getWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/v1/live`;
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
    maxReconnectAttempts = 20,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pingTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const isMounted = useRef(true);

  const setWsConnected = useDataStore(s => s.setWsConnected);
  const setEvents = useDataStore(s => s.setEvents);
  const addEvents = useDataStore(s => s.addEvents);
  const setActivity = useDataStore(s => s.setActivity);

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
            // Bulk data on connect — replace all events
            const data = msg.data || {};
            const allEvents: PlanetaryEvent[] = [];

            if (data.seismic) {
              allEvents.push(...data.seismic.map(transformSeismic));
            }
            if (data.solar_wind) {
              allEvents.push(...data.solar_wind.map(transformSolarWind));
            }
            if (data.goes) {
              allEvents.push(...data.goes.map(transformGoes));
            }
            if (data.volcanic) {
              allEvents.push(...data.volcanic.map(transformVolcanic));
            }

            setEvents(allEvents);
            // Don't set anomalies from sync — REST API handles that with proper z-scores

            console.log(`[WS] Sync: ${allEvents.length} events loaded`);
            break;
          }

          case 'seismic': {
            const records = msg.data || [];
            addEvents(records.map(transformSeismic));
            break;
          }

          case 'solar_wind': {
            const records = msg.data || [];
            addEvents(records.map(transformSolarWind));
            break;
          }

          case 'goes': {
            const records = msg.data || [];
            addEvents(records.map(transformGoes));
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
        console.log(`[WS] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectAttempt.current + 1})`);
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = (err) => {
      console.error('[WS] Error:', err);
    };
  }, [enabled, reconnectInterval, maxReconnectAttempts, setWsConnected, setEvents, addEvents]);

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
