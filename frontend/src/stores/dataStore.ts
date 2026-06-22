import { create } from 'zustand';
import type { PlanetaryEvent, Anomaly, ActivityAssessment, SystemStatus } from '../types';

// Raw data types for chart components (preserves source-specific fields)
export interface RawSeismicEvent {
  time: string;
  event_id: string;
  magnitude: number;
  latitude: number;
  longitude: number;
  depth_km: number | null;
  place: string | null;
  type: string;
  sig: number | null;
  felt: number | null;
  alert: string | null;
  tsunami: number;
}

export interface RawGoesReading {
  time: string;
  flux_type: string;
  energy_band: string;
  flux: number;
  satellite: string;
}

export interface RawSolarWindReading {
  time: string;
  data_type: string;
  density?: number;
  speed?: number;
  temperature?: number;
  bt?: number;
  bx_gsm?: number;
  by_gsm?: number;
  bz_gsm?: number;
}

interface DataState {
  events: PlanetaryEvent[];
  anomalies: Anomaly[];
  activity: ActivityAssessment | null;
  status: SystemStatus | null;
  isLoading: boolean;
  wsConnected: boolean;

  // Raw chart data (populated by WebSocket, consumed by chart components)
  rawSeismic: RawSeismicEvent[];
  rawGoes: RawGoesReading[];
  rawSolarWind: RawSolarWindReading[];

  // Replace all (used for initial load and sync)
  setEvents: (events: PlanetaryEvent[]) => void;
  setAnomalies: (anomalies: Anomaly[]) => void;
  setActivity: (activity: ActivityAssessment) => void;
  setStatus: (status: SystemStatus) => void;
  setLoading: (loading: boolean) => void;
  setWsConnected: (connected: boolean) => void;

  // Raw data setters (replace all — used for sync)
  setRawSeismic: (data: RawSeismicEvent[]) => void;
  setRawGoes: (data: RawGoesReading[]) => void;
  setRawSolarWind: (data: RawSolarWindReading[]) => void;

  // Append new (used for live WebSocket updates)
  addEvents: (events: PlanetaryEvent[]) => void;
  addAnomalies: (anomalies: Anomaly[]) => void;
  addRawSeismic: (data: RawSeismicEvent[]) => void;
  addRawGoes: (data: RawGoesReading[]) => void;
  addRawSolarWind: (data: RawSolarWindReading[]) => void;
}

// Max events to keep in memory (prevent unbounded growth)
const MAX_EVENTS = 2000;
const MAX_ANOMALIES = 500;
const MAX_RAW_SEISMIC = 1000;
const MAX_RAW_GOES = 500;
const MAX_RAW_SOLAR_WIND = 500;

export const useDataStore = create<DataState>((set) => ({
  events: [],
  anomalies: [],
  activity: null,
  status: null,
  isLoading: true,
  wsConnected: false,

  // Raw chart data
  rawSeismic: [],
  rawGoes: [],
  rawSolarWind: [],

  setEvents: (events) => set({ events }),
  setAnomalies: (anomalies) => set({ anomalies }),
  setActivity: (activity) => set({ activity }),
  setStatus: (status) => set({ status }),
  setLoading: (isLoading) => set({ isLoading }),
  setWsConnected: (wsConnected) => set({ wsConnected }),

  // Raw data replace-all setters
  setRawSeismic: (data) => set({ rawSeismic: data }),
  setRawGoes: (data) => set({ rawGoes: data }),
  setRawSolarWind: (data) => set({ rawSolarWind: data }),

  addEvents: (newEvents) => set((state) => {
    if (newEvents.length === 0) return state;
    // Deduplicate by event_id
    const existingIds = new Set(state.events.map(e => e.event_id));
    const unique = newEvents.filter(e => !existingIds.has(e.event_id));
    if (unique.length === 0) return state;
    // Prepend (newest first) and cap size
    const merged = [...unique, ...state.events].slice(0, MAX_EVENTS);
    return { events: merged };
  }),

  addAnomalies: (newAnomalies) => set((state) => {
    if (newAnomalies.length === 0) return state;
    const existingIds = new Set(state.anomalies.map(a => a.anomaly_id));
    const unique = newAnomalies.filter(a => !existingIds.has(a.anomaly_id));
    if (unique.length === 0) return state;
    const merged = [...unique, ...state.anomalies].slice(0, MAX_ANOMALIES);
    return { anomalies: merged };
  }),

  addRawSeismic: (newData) => set((state) => {
    if (newData.length === 0) return state;
    const existingIds = new Set(state.rawSeismic.map(e => e.event_id));
    const unique = newData.filter(e => !existingIds.has(e.event_id));
    if (unique.length === 0) return state;
    const merged = [...unique, ...state.rawSeismic].slice(0, MAX_RAW_SEISMIC);
    return { rawSeismic: merged };
  }),

  addRawGoes: (newData) => set((state) => {
    if (newData.length === 0) return state;
    // Deduplicate by time + flux_type + energy_band
    const existingKeys = new Set(
      state.rawGoes.map(r => `${r.time}|${r.flux_type}|${r.energy_band}`)
    );
    const unique = newData.filter(
      r => !existingKeys.has(`${r.time}|${r.flux_type}|${r.energy_band}`)
    );
    if (unique.length === 0) return state;
    const merged = [...unique, ...state.rawGoes].slice(0, MAX_RAW_GOES);
    return { rawGoes: merged };
  }),

  addRawSolarWind: (newData) => set((state) => {
    if (newData.length === 0) return state;
    // Deduplicate by time + data_type
    const existingKeys = new Set(
      state.rawSolarWind.map(r => `${r.time}|${r.data_type}`)
    );
    const unique = newData.filter(
      r => !existingKeys.has(`${r.time}|${r.data_type}`)
    );
    if (unique.length === 0) return state;
    const merged = [...unique, ...state.rawSolarWind].slice(0, MAX_RAW_SOLAR_WIND);
    return { rawSolarWind: merged };
  }),
}));
