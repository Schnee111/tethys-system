import { useMemo } from 'react';
import { useGlobeStore } from '../stores/globeStore';

/**
 * Dynamic glass background based on zoom level.
 * Zoomed out (space/dark bg) → white glass (visible over dark)
 * Zoomed in (terrain/bright bg) → black glass (readable over bright)
 */
export function useGlassStyle() {
  const altitude = useGlobeStore(s => s.altitude);

  return useMemo(() => {
    const isZoomedIn = altitude < 0.5;
    return {
      background: isZoomedIn
        ? 'rgba(0,0,0,0.50)'   // Dark glass over bright terrain
        : 'rgba(255,255,255,0.06)', // White glass over dark space
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    };
  }, [altitude]);
}
