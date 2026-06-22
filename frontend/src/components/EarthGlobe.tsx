import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import Globe from 'react-globe.gl';
import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';
import { DOMAIN_COLORS } from '../utils/colors';

const GLOBE_HOURS = 2;
const FLY_ALTITUDE = 1.0;
const FLY_DURATION = 1200;

// Impact radius in degrees (approximate) based on magnitude
// M1 = ~10km ≈ 0.09°, M3 = ~30km ≈ 0.27°, M5 = ~100km ≈ 0.9°
function impactRadius(mag: number): number {
  return Math.max(0.05, Math.pow(10, (mag || 1) * 0.4 - 0.6) * 0.01);
}

// Shared globe ref for external camera control
let globeInstance: any = null;
export function getGlobe() { return globeInstance; }

export function EarthGlobe() {
  const globeRef = useRef<any>(null);
  const { events } = useDataStore();
  const { activeCategories, minMagnitude, maxMagnitude, timelinePercent, selectedEvent } = useGlobeStore();
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const prevSelectedRef = useRef<string | null>(null);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Init globe
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.15;
    globeInstance = globe;
    return () => { globeInstance = null; };
  }, []);

  // Fly to selected event (only when selection actually changes)
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const eventId = selectedEvent?.event_id || null;
    if (eventId === prevSelectedRef.current) return; // No change
    prevSelectedRef.current = eventId;

    if (selectedEvent) {
      globe.controls().autoRotate = false;
      globe.pointOfView(
        { lat: selectedEvent.latitude, lng: selectedEvent.longitude, altitude: FLY_ALTITUDE },
        FLY_DURATION
      );
    } else {
      // Delay resume to avoid jitter
      setTimeout(() => {
        if (globe && !prevSelectedRef.current) {
          globe.controls().autoRotate = true;
          globe.controls().autoRotateSpeed = 0.15;
        }
      }, 300);
    }
  }, [selectedEvent]);

  // Time window
  const timeWindowHours = useMemo(() => {
    if (timelinePercent >= 99) return GLOBE_HOURS;
    return Math.max(0.5, (timelinePercent / 100) * 12);
  }, [timelinePercent]);

  const cutoffTime = useMemo(() => {
    return Date.now() - timeWindowHours * 60 * 60 * 1000;
  }, [timeWindowHours]);

  // Filter
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

  // Pillar lines
  const points = filteredEvents.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    altitude: 0.01 + (e.magnitude || 1) * 0.004,
    size: 0.03,
    color: DOMAIN_COLORS[e.domain] || '#6b7280',
  }));

  // Spheres + impact rings
  const sphereAlt = filteredEvents.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    alt: 0.01 + (e.magnitude || 1) * 0.004,
    size: Math.max(0.15, (e.magnitude || 1) * 0.05),
    color: DOMAIN_COLORS[e.domain] || '#6b7280',
    event: e,
    // Impact ring data
    ringRadius: impactRadius(e.magnitude || 1),
    ringColor: DOMAIN_COLORS[e.domain] || '#6b7280',
    label: `${e.domain.toUpperCase()} — M${e.magnitude?.toFixed(1) || '?'}\n${e.location}\nDepth: ${e.depth_km?.toFixed(1) || '?'}km`,
  }));

  // Custom Three.js object: sphere + impact ring
  const createObject = (d: any) => {
    const group = new THREE.Group();

    // Sphere marker
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(d.size, 16, 16),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(d.color),
        transparent: true,
        opacity: 0.95,
      })
    );
    group.add(sphere);

    // Impact ring (flat circle on surface)
    const ringGeo = new THREE.RingGeometry(d.ringRadius * 0.8, d.ringRadius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(d.ringColor),
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2; // Flat on surface
    group.add(ring);

    return group;
  };

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
      // Spheres + rings
      objectsData={sphereAlt}
      objectLat="lat"
      objectLng="lng"
      objectAltitude="alt"
      objectLabel="label"
      objectThreeObject={createObject}
    />
  );
}
