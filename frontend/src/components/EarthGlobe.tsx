import { useRef, useEffect, useState } from 'react';
import Globe from 'react-globe.gl';
import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';

export function EarthGlobe() {
  const globeRef = useRef<any>(null);
  const { events } = useDataStore();
  const { setSelectedEvent } = useGlobeStore();
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.2;
  }, []);

  const points = events.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    size: Math.max(0.02, (e.magnitude || 2) * 0.008),
    color: getColor(e.magnitude || 2),
    event: e,
  }));

  return (
    <Globe
      ref={globeRef}
      width={size.w}
      height={size.h}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
      backgroundColor="rgba(0,0,0,0)"
      showAtmosphere={true}
      atmosphereColor="#1a3a6a"
      atmosphereAltitude={0.15}
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={0.005}
      pointColor="color"
      pointRadius="size"
      onPointClick={(p: any) => setSelectedEvent(p.event)}
    />
  );
}

function getColor(mag: number): string {
  if (mag >= 6) return '#dc2626';
  if (mag >= 5) return '#ef4444';
  if (mag >= 4) return '#f59e0b';
  if (mag >= 3) return '#94a3b8';
  return '#64748b';
}
