import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import Globe from 'react-globe.gl';
import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';
import { DOMAIN_COLORS } from '../utils/colors';

const GLOBE_HOURS = 2;
const FLY_ALTITUDE = 1.0;
const FLY_DURATION = 1200;
const GLOBE_RADIUS = 100; // default globe.gl radius in Three.js units

// Shared globe ref for external camera control
let globeInstance: any = null;
export function getGlobe() { return globeInstance; }

export function EarthGlobe() {
  const globeRef = useRef<any>(null);
  const { events } = useDataStore();
  const { activeCategories, minMagnitude, maxMagnitude, timelinePercent, selectedEvent } = useGlobeStore();
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const prevEventIdRef = useRef<string | null>(null);

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

  // Fly to selected event — only when ID changes
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;

    const newId = selectedEvent ? `${selectedEvent.event_id}-${selectedEvent.time}` : null;
    if (newId === prevEventIdRef.current) return;
    prevEventIdRef.current = newId;

    if (selectedEvent) {
      globe.controls().autoRotate = false;
      globe.pointOfView(
        { lat: selectedEvent.latitude, lng: selectedEvent.longitude, altitude: FLY_ALTITUDE },
        FLY_DURATION
      );
    } else {
      setTimeout(() => {
        if (globeRef.current && !prevEventIdRef.current) {
          globeRef.current.controls().autoRotate = true;
          globeRef.current.controls().autoRotateSpeed = 0.15;
        }
      }, 500);
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

  // Spheres with impact rings
  const sphereAlt = filteredEvents.map((e) => {
    const mag = e.magnitude || 1;
    // Convert km radius to Three.js units
    // 1 degree ≈ 111km, globe circumference = 2π * 100 ≈ 628 units
    // So 1km ≈ 628 / 40075 ≈ 0.0157 units
    // Impact radius in km: ~10^(mag*0.5) roughly
    const radiusKm = Math.pow(10, mag * 0.45) * 1.5;
    const radiusUnits = radiusKm * 0.0157;

    return {
      lat: e.latitude,
      lng: e.longitude,
      alt: 0.01 + mag * 0.004,
      size: Math.max(0.15, mag * 0.05),
      color: DOMAIN_COLORS[e.domain] || '#6b7280',
      event: e,
      ringRadius: Math.max(0.5, Math.min(radiusUnits, 15)),
      ringColor: DOMAIN_COLORS[e.domain] || '#6b7280',
      label: `${e.domain.toUpperCase()} — M${e.magnitude?.toFixed(1) || '?'}\n${e.location}\nDepth: ${e.depth_km?.toFixed(1) || '?'}km`,
    };
  });

  // Custom object: sphere + ring
  const createObject = (d: any) => {
    const group = new THREE.Group();

    // Marker sphere
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(d.size, 16, 16),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(d.color),
        transparent: true,
        opacity: 0.95,
      })
    );
    group.add(sphere);

    // Impact ring — flat on globe surface
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(d.ringRadius * 0.7, d.ringRadius, 48),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(d.ringColor),
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      })
    );
    // Ring sits at sphere position, flat
    ring.position.y = -d.alt;
    ring.rotation.x = -Math.PI / 2;
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
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointAltitude="altitude"
      pointColor="color"
      pointRadius="size"
      pointResolution={6}
      pointsMerge={false}
      objectsData={sphereAlt}
      objectLat="lat"
      objectLng="lng"
      objectAltitude="alt"
      objectLabel="label"
      objectThreeObject={createObject}
    />
  );
}
