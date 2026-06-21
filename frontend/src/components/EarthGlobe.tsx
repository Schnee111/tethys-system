import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import Globe from 'react-globe.gl';
import { useDataStore } from '../stores/dataStore';

function getColor(mag: number): string {
  if (mag >= 6) return '#dc2626';
  if (mag >= 5) return '#ef4444';
  if (mag >= 4) return '#f59e0b';
  if (mag >= 3) return '#94a3b8';
  return '#64748b';
}

// Lighthouse marker: thin line + glowing sphere on top
function createLighthouse(d: any): THREE.Object3D {
  const group = new THREE.Group();
  const color = new THREE.Color(d.color);
  const height = (d.event?.magnitude || 2) * 0.8 + 1;

  // Thin pillar line
  const lineGeo = new THREE.CylinderGeometry(0.003, 0.003, height, 4);
  const lineMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.position.y = height / 2;
  group.add(line);

  // Glowing sphere on top
  const sphereSize = Math.max(0.08, (d.event?.magnitude || 2) * 0.025);
  const sphereGeo = new THREE.SphereGeometry(sphereSize, 12, 12);
  const sphereMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.y = height;
  group.add(sphere);

  return group;
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

  const points = events.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    altitude: 0.01,
    size: 0.1,
    color: getColor(e.magnitude || 2),
    event: e,
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
    // @ts-expect-error — pointThreeObject exists but types are outdated
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
      pointThreeObject={createLighthouse}
    />
  );
}
