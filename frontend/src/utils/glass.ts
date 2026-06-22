import { useMemo } from 'react';
import { useGlobeStore } from '../stores/globeStore';

/**
 * Dynamic glass background based on zoom level.
 * Zoomed out (space/dark) → lighter glass
 * Zoomed in (terrain/bright) → darker glass
 */
export function useGlassStyle() {
  const altitude = useGlobeStore(s => s.altitude);

  return useMemo(() => {
    const t = Math.max(0, Math.min(1, (altitude - 0.3) / 2.2));
    const opacity = 0.06 + t * 0.44;
    return {
      background: `rgba(0,0,0,${opacity.toFixed(2)})`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    };
  }, [altitude]);
}
