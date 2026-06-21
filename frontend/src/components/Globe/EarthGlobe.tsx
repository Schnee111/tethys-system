import { useRef, useEffect } from 'react';
import Globe from 'react-globe.gl';
import { useDataStore } from '../../stores/dataStore';
import { useGlobeStore } from '../../stores/globeStore';

export function EarthGlobe() {
  const globeRef = useRef<any>(null);
  const { events } = useDataStore();
  const { setSelectedEvent } = useGlobeStore();

  // Auto-rotate
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.2;
  }, []);

  // Map events to globe points
  const points = events.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    size: Math.max(0.02, (e.magnitude || 2) * 0.01),
    color: getSeverityColor(e.magnitude || 2),
    event: e,
  }));

  return (
    <div className="w-full h-full relative">
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        showAtmosphere={true}
        atmosphereColor="#1a3a6a"
        atmosphereAltitude={0.15}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={0.01}
        pointColor="color"
        pointRadius="size"
        onPointClick={(p: any) => setSelectedEvent(p.event)}
      />
    </div>
  );
}

function getSeverityColor(magnitude: number): string {
  if (magnitude >= 6) return '#dc2626';
  if (magnitude >= 5) return '#ef4444';
  if (magnitude >= 4) return '#f59e0b';
  if (magnitude >= 3) return '#94a3b8';
  return '#64748b';
}
