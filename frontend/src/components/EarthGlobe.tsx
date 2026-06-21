import { useRef, useEffect, useState, useCallback } from 'react';
import Globe from 'react-globe.gl';
import { useDataStore } from '../stores/dataStore';

function getColor(mag: number): string {
  if (mag >= 6) return '#dc2626';
  if (mag >= 5) return '#ef4444';
  if (mag >= 4) return '#f59e0b';
  if (mag >= 3) return '#94a3b8';
  return '#64748b';
}

export function EarthGlobe() {
  const globeRef = useRef<any>(null);
  const { events } = useDataStore();
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const autoRotateRef = useRef(true);

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

    // Stop rotation on hover, resume on leave
    const container = globe.renderer()?.domElement?.parentElement;
    if (container) {
      container.addEventListener('mouseenter', () => {
        globe.controls().autoRotate = false;
      });
      container.addEventListener('mouseleave', () => {
        globe.controls().autoRotate = true;
      });
    }
  }, []);

  const points = events.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    size: Math.max(0.2, (e.magnitude || 2) * 0.08),
    color: getColor(e.magnitude || 2),
    event: e,
    label: `M${e.magnitude?.toFixed(1)} — ${e.location}\nDepth: ${e.depth_km?.toFixed(0) || '?'}km`,
  }));

  return (
    <Globe
      ref={globeRef}
      width={size.w}
      height={size.h}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
      showAtmosphere={true}
      atmosphereColor="#38bdf8"
      atmosphereAltitude={0.2}
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={0.01}
      pointColor="color"
      pointRadius="size"
      pointResolution={32}
      pointsMerge={false}
      pointLabel="label"
    />
  );
}
