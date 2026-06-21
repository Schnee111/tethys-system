import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import Globe from 'react-globe.gl';
import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';

const COLOR_MAP: Record<string, string> = {
  critical: '#dc2626',
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#94a3b8',
};

function getColor(mag: number): string {
  if (mag >= 6) return COLOR_MAP.critical;
  if (mag >= 5) return COLOR_MAP.high;
  if (mag >= 4) return COLOR_MAP.medium;
  return '#64748b';
}

function getSeverity(mag: number): string {
  if (mag >= 6) return 'critical';
  if (mag >= 5) return 'high';
  if (mag >= 4) return 'medium';
  return 'low';
}

// Create a custom marker: thin line + glowing sphere on top
function createMarker(d: any): THREE.Object3D {
  const group = new THREE.Group();
  const color = new THREE.Color(d.color);

  // Thin line from surface
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, d.size * 3, 0),
  ]);
  const lineMat = new THREE.LineBasicMaterial({ color, opacity: 0.6, transparent: true });
  const line = new THREE.Line(lineGeo, lineMat);
  group.add(line);

  // Glowing sphere on top
  const sphereGeo = new THREE.SphereGeometry(d.size * 0.8, 16, 16);
  const sphereMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.y = d.size * 3;
  group.add(sphere);

  // Outer glow ring
  const ringGeo = new THREE.RingGeometry(d.size * 1.2, d.size * 2, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = d.size * 3;
  ring.lookAt(new THREE.Vector3(0, 1000, 0)); // Face outward
  group.add(ring);

  return group;
}

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
    size: Math.max(0.08, (e.magnitude || 2) * 0.03),
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
      showAtmosphere={true}
      atmosphereColor="#38bdf8"
      atmosphereAltitude={0.2}
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={0.01}
      pointColor="color"
      pointRadius="size"
      pointThreeObject={createMarker}
      onPointClick={(p: any) => setSelectedEvent(p.event)}
    />
  );
}
