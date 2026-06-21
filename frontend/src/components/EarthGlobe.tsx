import { useRef, useEffect, useState } from 'react';
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

  // Points: thin pillars (line-like) with small cap
  const points = events.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    altitude: 0.01 + (e.magnitude || 2) * 0.005,  // taller for bigger quakes
    size: 0.08,  // thin radius = looks like a line
    color: getColor(e.magnitude || 2),
    event: e,
    // Hover label
    label: `<div style="
      background: rgba(10,10,15,0.95);
      border: 1px solid rgba(196,163,90,0.3);
      border-radius: 8px;
      padding: 10px 14px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #e0e6ed;
      line-height: 1.6;
      white-space: nowrap;
    ">
      <div style="font-weight:600;color:#c4a35a;margin-bottom:4px;">
        M${e.magnitude?.toFixed(1)} — ${e.location}
      </div>
      <div style="color:#999;font-size:10px;">
        Depth: ${e.depth_km?.toFixed(1) || '?'}km · ${e.domain}
      </div>
    </div>`,
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
      pointAltitude="altitude"
      pointColor="color"
      pointRadius="size"
      pointResolution={6}
      pointsMerge={false}
      pointLabel="label"
    />
  );
}
