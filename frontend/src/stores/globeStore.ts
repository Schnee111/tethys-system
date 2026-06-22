import { create } from 'zustand';
import type { PlanetaryEvent } from '../types';

interface GlobeState {
  selectedEvent: PlanetaryEvent | null;
  isLive: boolean;
  timelinePercent: number;
  activeCategories: Set<string>;
  minMagnitude: number;
  maxMagnitude: number;
  altitude: number; // Current zoom level
  setSelectedEvent: (event: PlanetaryEvent | null) => void;
  setLive: (live: boolean) => void;
  setTimelinePercent: (percent: number) => void;
  setActiveCategories: (categories: Set<string>) => void;
  toggleCategory: (category: string) => void;
  setMinMagnitude: (mag: number) => void;
  setMaxMagnitude: (mag: number) => void;
  setAltitude: (alt: number) => void;
}

export const useGlobeStore = create<GlobeState>((set) => ({
  selectedEvent: null,
  isLive: true,
  timelinePercent: 100,
  activeCategories: new Set(['seismic', 'solar', 'atmospheric']),
  minMagnitude: 0,
  maxMagnitude: 8,
  altitude: 2.0,
  setSelectedEvent: (selectedEvent) => set({ selectedEvent }),
  setLive: (isLive) => set({ isLive }),
  setTimelinePercent: (timelinePercent) => set({ timelinePercent }),
  setActiveCategories: (activeCategories) => set({ activeCategories }),
  toggleCategory: (category) => set((state) => {
    const next = new Set(state.activeCategories);
    if (next.has(category)) {
      if (next.size > 1) next.delete(category);
    } else {
      next.add(category);
    }
    return { activeCategories: next };
  }),
  setMinMagnitude: (minMagnitude) => set({ minMagnitude }),
  setMaxMagnitude: (maxMagnitude) => set({ maxMagnitude }),
  setAltitude: (altitude) => set({ altitude }),
}));
