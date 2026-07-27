import { useMemo } from 'react';
import { useGlobeStore } from '../stores/globeStore';

// MapLibre's normalized altitude is ~0.091 at the initial zoom (2.5).
// Keep panels white longer, then crossfade only when approaching terrain.
const TERRAIN_ALTITUDE = 0.018;
const SPACE_ALTITUDE = 0.055;

/**
 * Dynamic glass — smooth crossfade between white and black.
 * Far (space/dark bg)   → white glass (visible)
 * Close (terrain/bright) → black glass (readable)
 */
export function useGlassStyle() {
  const altitude = useGlobeStore(s => s.altitude);

  return useMemo(() => {
    const t = Math.max(0, Math.min(
      1,
      (altitude - TERRAIN_ALTITUDE) / (SPACE_ALTITUDE - TERRAIN_ALTITUDE),
    ));
    const blackOpacity = (1 - t) * 0.45;
    const whiteOpacity = t * 0.06;

    return {
      background: `linear-gradient(rgba(0,0,0,${blackOpacity.toFixed(3)}), rgba(0,0,0,${blackOpacity.toFixed(3)})), linear-gradient(rgba(255,255,255,${whiteOpacity.toFixed(3)}), rgba(255,255,255,${whiteOpacity.toFixed(3)}))`,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    };
  }, [altitude]);
}
