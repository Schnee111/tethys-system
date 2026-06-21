import { create } from 'zustand';
import type { PlanetaryEvent } from '../types';

interface GlobeState {
  selectedEvent: PlanetaryEvent | null;
  isLive: boolean;
  timelinePercent: number;
  setSelectedEvent: (event: PlanetaryEvent | null) => void;
  setLive: (live: boolean) => void;
  setTimelinePercent: (percent: number) => void;
}

export const useGlobeStore = create<GlobeState>((set) => ({
  selectedEvent: null,
  isLive: true,
  timelinePercent: 100,
  setSelectedEvent: (selectedEvent) => set({ selectedEvent }),
  setLive: (isLive) => set({ isLive }),
  setTimelinePercent: (timelinePercent) => set({ timelinePercent }),
}));
