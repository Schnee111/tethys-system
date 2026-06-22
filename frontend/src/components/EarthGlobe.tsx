import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import Globe from 'react-globe.gl';
import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';
import { DOMAIN_COLORS } from '../utils/colors';

const GLOBE_HOURS = 2;
const FLY_ALTITUDE = 1.0;
const FLY_DURATION = 1200;
const GLOBE_RADIUS = 100;

let globeInstance: any = null;
export function getGlobe() { return globeInstance; }

export function EarthGlobe() {
  const globeRef = useRef<any>(null);
  const { events } = useDataStore();
  const { activeCategories, minMagnitude, maxMagnitude, timelinePercent, selectedEvent } = useGlobeStore();
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const prevEventIdRef = useRef<string | null>(null);
  const ringsGroupRef = useRef<THREE.Group>(new THREE.Group());

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.15;
    globeInstance = globe;
    // Add rings group to scene
    globe.scene().add(ringsGroupRef.current);
    return () => {
      globeInstance = null;
      globe.scene().remove(ringsGroupRef.current);
    };
  }, []);

  // Fly to selected event
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

  const timeWindowHours = useMemo(() => {
    if (timelinePercent >= 99) return GLOBE_HOURS;
    return Math.max(0.5, (timelinePercent / 100) * 12);
  }, [timelinePercent]);

  const cutoffTime = useMemo(() => Date.now() - timeWindowHours * 60 * 60 * 1000, [timeWindowHours]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (!activeCategories.has(e.domain)) return false;
      if ((e.magnitude || 0) < minMagnitude) return false;
      if ((e.magnitude || 0) > maxMagnitude) return false;
      return new Date(e.time).getTime() >= cutoffTime;
    });
  }, [events, activeCategories, minMagnitude, maxMagnitude, cutoffTime]);

  // Update impact rings on the globe surface
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const group = ringsGroupRef.current;

    // Clear old rings
    while (group.children.length > 0) {
      const child = group.children[0] as THREE.Mesh;
      (child.geometry as THREE.BufferGeometry).dispose();
      (child.material as THREE.Material).dispose();
      group.remove(child);
    }

    // Create new rings
    filteredEvents.forEach((e) => {
      const mag = e.magnitude || 1;
      const radiusKm = Math.pow(10, mag * 0.45) * 1.5;
      const radiusUnits = Math.max(1, Math.min(radiusKm * (GLOBE_RADIUS / 40075) * 111, 20));

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radiusUnits * 0.7, radiusUnits, 48),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(DOMAIN_COLORS[e.domain] || '#6b7280'),
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
        })
      );

      // Position on globe surface using globe.getCoords
      const coords = globe.getCoords(e.latitude, e.longitude, 0.001);
      ring.position.copy(coords);

      // Orient ring to face away from globe center (flat on surface)
      ring.lookAt(0, 0, 0);

      group.add(ring);
    });
  }, [filteredEvents]);

  // Pillar lines
  const points = filteredEvents.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    altitude: 0.01 + (e.magnitude || 1) * 0.004,
    size: 0.03,
    color: DOMAIN_COLORS[e.domain] || '#6b7280',
  }));

  // Marker spheres
  const markers = filteredEvents.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    alt: 0.01 + (e.magnitude || 1) * 0.004,
    size: Math.max(0.15, (e.magnitude || 1) * 0.05),
    color: DOMAIN_COLORS[e.domain] || '#6b7280',
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
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointAltitude="altitude"
      pointColor="color"
      pointRadius="size"
      pointResolution={6}
      pointsMerge={false}
      objectsData={markers}
      objectLat="lat"
      objectLng="lng"
      objectAltitude="alt"
      objectLabel="label"
      objectThreeObject={(d: any) => new THREE.Mesh(
        new THREE.SphereGeometry(d.size, 16, 16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(d.color), transparent: true, opacity: 0.95 })
      )}
    />
  );
}
