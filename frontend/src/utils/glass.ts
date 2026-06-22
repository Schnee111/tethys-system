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
    const isDark = altitude < 1.0;
    const opacity = isDark ? 0.50 : 0.15;
    console.log(`[GLASS] alt=${altitude.toFixed(2)} → ${isDark ? 'DARK' : 'LIGHT'} opacity=${opacity}`);
    return {
      background: `rgba(0,0,0,${opacity})`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    };
  }, [altitude]);
}
