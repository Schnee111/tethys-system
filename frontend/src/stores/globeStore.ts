import { create } from 'zustand';

type ViewMode = 'globe' | 'map';

interface GlobeState {
  viewMode: ViewMode;
  selectedEvent: any | null;
  mapCenter: [number, number];
  mapZoom: number;
  isLive: boolean;
  timelinePercent: number;

  setViewMode: (mode: ViewMode) => void;
  setSelectedEvent: (event: any | null) => void;
  setMapCenter: (center: [number, number]) => void;
  setMapZoom: (zoom: number) => void;
  setLive: (live: boolean) => void;
  setTimelinePercent: (percent: number) => void;
}

export const useGlobeStore = create<GlobeState>((set) => ({
  viewMode: 'globe',
  selectedEvent: null,
  mapCenter: [0, 0],
  mapZoom: 2,
  isLive: true,
  timelinePercent: 100,

  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedEvent: (selectedEvent) => set({ selectedEvent }),
  setMapCenter: (mapCenter) => set({ mapCenter }),
  setMapZoom: (mapZoom) => set({ mapZoom }),
  setLive: (isLive) => set({ isLive }),
  setTimelinePercent: (timelinePercent) => set({ timelinePercent }),
}));
