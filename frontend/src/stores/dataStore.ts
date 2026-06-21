import { create } from 'zustand';
import type { PlanetaryEvent, Anomaly, ActivityAssessment, SystemStatus } from '../types';

interface DataState {
  events: PlanetaryEvent[];
  anomalies: Anomaly[];
  activity: ActivityAssessment | null;
  status: SystemStatus | null;
  isLoading: boolean;

  setEvents: (events: PlanetaryEvent[]) => void;
  addEvent: (event: PlanetaryEvent) => void;
  setAnomalies: (anomalies: Anomaly[]) => void;
  setActivity: (activity: ActivityAssessment) => void;
  setStatus: (status: SystemStatus) => void;
  setLoading: (loading: boolean) => void;
}

export const useDataStore = create<DataState>((set) => ({
  events: [],
  anomalies: [],
  activity: null,
  status: null,
  isLoading: true,

  setEvents: (events) => set({ events }),
  addEvent: (event) => set((state) => ({
    events: [event, ...state.events].slice(0, 500),
  })),
  setAnomalies: (anomalies) => set({ anomalies }),
  setActivity: (activity) => set({ activity }),
  setStatus: (status) => set({ status }),
  setLoading: (isLoading) => set({ isLoading }),
}));
