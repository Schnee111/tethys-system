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

  // Lighthouse objects: thin line + sphere on top
  const objects = events.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    alt: 0.01,
    color: getColor(e.magnitude || 2),
    magnitude: e.magnitude || 2,
    label: `M${e.magnitude?.toFixed(1)} — ${e.location}\nDepth: ${e.depth_km?.toFixed(1) || '?'}km`,
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
      // Custom 3D objects layer
      objectsData={objects}
      objectLat="lat"
      objectLng="lng"
      objectAltitude="alt"
      objectLabel="label"
      objectThreeObject={(d: any) => {
        const group = new THREE.Group();
        const color = new THREE.Color(d.color);
        const height = d.magnitude * 0.8 + 1;
        const sphereSize = Math.max(0.12, d.magnitude * 0.04);

        // Thin pillar
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.004, 0.004, height, 4),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
        );
        pillar.position.y = height / 2;
        group.add(pillar);

        // Glowing sphere on top
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(sphereSize, 16, 16),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
        );
        sphere.position.y = height;
        group.add(sphere);

        return group;
      }}
    />
  );
}
