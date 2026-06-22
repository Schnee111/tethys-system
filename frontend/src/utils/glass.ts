import { useMemo } from 'react';
import { useGlobeStore } from '../stores/globeStore';

/**
 * Dynamic glass — smooth crossfade between white and black.
 * Far (space/dark bg)   → white glass (visible)
 * Close (terrain/bright) → black glass (readable)
 */
export function useGlassStyle() {
  const altitude = useGlobeStore(s => s.altitude);

  return useMemo(() => {
    const t = Math.max(0, Math.min(1, (altitude - 0.4) / 1.1));

    // t=0 (close): black at 0.45
    // t=1 (far): white at 0.06
    // Crossfade: both layers, one fading in, other fading out
    const blackOpacity = (1 - t) * 0.45;
    const whiteOpacity = t * 0.06;

    return {
      background: `linear-gradient(rgba(0,0,0,${blackOpacity.toFixed(3)}), rgba(0,0,0,${blackOpacity.toFixed(3)})), linear-gradient(rgba(255,255,255,${whiteOpacity.toFixed(3)}), rgba(255,255,255,${whiteOpacity.toFixed(3)}))`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    };
  }, [altitude]);
}
