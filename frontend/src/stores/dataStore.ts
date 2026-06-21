import { create } from 'zustand';
import type { PlanetaryEvent, Anomaly, ActivityAssessment, SystemStatus } from '../types';

interface DataState {
  events: PlanetaryEvent[];
  anomalies: Anomaly[];
  activity: ActivityAssessment | null;
  status: SystemStatus | null;
  isLoading: boolean;
  wsConnected: boolean;

  // Replace all (used for initial load and sync)
  setEvents: (events: PlanetaryEvent[]) => void;
  setAnomalies: (anomalies: Anomaly[]) => void;
  setActivity: (activity: ActivityAssessment) => void;
  setStatus: (status: SystemStatus) => void;
  setLoading: (loading: boolean) => void;
  setWsConnected: (connected: boolean) => void;

  // Append new (used for live WebSocket updates)
  addEvents: (events: PlanetaryEvent[]) => void;
  addAnomalies: (anomalies: Anomaly[]) => void;
}

// Max events to keep in memory (prevent unbounded growth)
const MAX_EVENTS = 2000;
const MAX_ANOMALIES = 500;

export const useDataStore = create<DataState>((set) => ({
  events: [],
  anomalies: [],
  activity: null,
  status: null,
  isLoading: true,
  wsConnected: false,

  setEvents: (events) => set({ events }),
  setAnomalies: (anomalies) => set({ anomalies }),
  setActivity: (activity) => set({ activity }),
  setStatus: (status) => set({ status }),
  setLoading: (isLoading) => set({ isLoading }),
  setWsConnected: (wsConnected) => set({ wsConnected }),

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
}));
