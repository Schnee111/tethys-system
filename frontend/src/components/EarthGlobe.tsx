import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import Globe from 'react-globe.gl';
import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';
import { magnitudeColor } from '../utils/colors';

export function EarthGlobe() {
  const globeRef = useRef<any>(null);
  const { events } = useDataStore();
  const { activeCategories } = useGlobeStore();
  const filteredEvents = events.filter(e => activeCategories.has(e.domain));
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

  // Thin pillar lines (native globe.gl points)
  const points = filteredEvents.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    altitude: 0.01 + (e.magnitude || 2) * 0.005,
    size: 0.03,
    color: magnitudeColor(e.magnitude || 0.5),
  }));

  // Glowing spheres on top of pillars
  const sphereAlt = filteredEvents.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    alt: 0.01 + (e.magnitude || 2) * 0.005,
    size: Math.max(0.2, (e.magnitude || 2) * 0.06),
    color: magnitudeColor(e.magnitude || 0.5),
    event: e,
    label: `M${e.magnitude?.toFixed(1)} — ${e.location}\nDepth: ${e.depth_km?.toFixed(1) || '?'}km`,
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
      // Thin pillar lines (native pointsData — keeps original look)
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointAltitude="altitude"
      pointColor="color"
      pointRadius="size"
      pointResolution={6}
      pointsMerge={false}
      // Glowing spheres on top (objectsData layer)
      objectsData={sphereAlt}
      objectLat="lat"
      objectLng="lng"
      objectAltitude="alt"
      objectLabel="label"
      objectThreeObject={(d: any) => {
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(d.size, 16, 16),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(d.color),
            transparent: true,
            opacity: 0.95,
          })
        );
        return sphere;
      }}
    />
  );
}
