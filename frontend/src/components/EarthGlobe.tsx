import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import Globe from 'react-globe.gl';
import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';
import { DOMAIN_COLORS } from '../utils/colors';

// How many hours back the globe shows by default
const GLOBE_HOURS = 2;

// Shared globe ref for external control (camera, rotation)
let globeInstance: any = null;
export function getGlobe() { return globeInstance; }

export function EarthGlobe() {
  const globeRef = useRef<any>(null);
  const { events } = useDataStore();
  const { activeCategories, minMagnitude, maxMagnitude, timelinePercent, selectedEvent } = useGlobeStore();
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Init globe — auto-rotate + expose instance
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.2;
    globeInstance = globe;
    return () => { globeInstance = null; };
  }, []);

  // When an event is selected → fly to it + pause rotation
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    if (selectedEvent) {
      // Pause auto-rotation
      globe.controls().autoRotate = false;
      // Fly to event location
      globe.pointOfView(
        { lat: selectedEvent.latitude, lng: selectedEvent.longitude, altitude: 1.5 },
        1000
      );
    } else {
      // Resume auto-rotation when nothing selected
      globe.controls().autoRotate = true;
      globe.controls().autoRotateSpeed = 0.2;
    }
  }, [selectedEvent]);

  // Calculate time window based on timeline slider
  const timeWindowHours = useMemo(() => {
    if (timelinePercent >= 99) return GLOBE_HOURS;
    return Math.max(0.5, (timelinePercent / 100) * 12);
  }, [timelinePercent]);

  const cutoffTime = useMemo(() => {
    return Date.now() - timeWindowHours * 60 * 60 * 1000;
  }, [timeWindowHours]);

  // Filter: domain + time + magnitude
  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (!activeCategories.has(e.domain)) return false;
      if ((e.magnitude || 0) < minMagnitude) return false;
      if ((e.magnitude || 0) > maxMagnitude) return false;
      const eventTime = new Date(e.time).getTime();
      if (eventTime < cutoffTime) return false;
      return true;
    });
  }, [events, activeCategories, minMagnitude, maxMagnitude, cutoffTime]);

  // Pillar lines — color by DOMAIN, height by magnitude
  const points = filteredEvents.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    altitude: 0.01 + (e.magnitude || 1) * 0.004,
    size: 0.03,
    color: DOMAIN_COLORS[e.domain] || '#6b7280',
  }));

  // Spheres — color by DOMAIN, size by magnitude
  const sphereAlt = filteredEvents.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    alt: 0.01 + (e.magnitude || 1) * 0.004,
    size: Math.max(0.15, (e.magnitude || 1) * 0.05),
    color: DOMAIN_COLORS[e.domain] || '#6b7280',
    event: e,
    label: `${e.domain.toUpperCase()} — M${e.magnitude?.toFixed(1) || '?'}\n${e.location}\nDepth: ${e.depth_km?.toFixed(1) || '?'}km`,
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
      // Pillar lines
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointAltitude="altitude"
      pointColor="color"
      pointRadius="size"
      pointResolution={6}
      pointsMerge={false}
      // Spheres on top
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
