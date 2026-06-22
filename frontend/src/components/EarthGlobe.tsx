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
const PULSE_COUNT = 3;
const PULSE_SPEED = 0.003; // Slower — was 0.008
const PULSE_MAX_SCALE = 2.0; // Smaller expansion — was 3.0

let globeInstance: any = null;
export function getGlobe() { return globeInstance; }

// Pulse ring data for animation
interface PulseRing {
  mesh: THREE.Mesh;
  baseRadius: number;
  scale: number;
  speed: number;
  phase: number; // offset for staggered pulses
}

export function EarthGlobe() {
  const globeRef = useRef<any>(null);
  const { events } = useDataStore();
  const { activeCategories, minMagnitude, maxMagnitude, timelinePercent, selectedEvent } = useGlobeStore();
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const prevEventIdRef = useRef<string | null>(null);
  const ringsGroupRef = useRef<THREE.Group>(new THREE.Group());
  const pulseRingsRef = useRef<PulseRing[]>([]);
  const animFrameRef = useRef<number>(0);

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
    globe.scene().add(ringsGroupRef.current);

    // Animation loop for pulse rings
    const animate = () => {
      pulseRingsRef.current.forEach(pulse => {
        pulse.scale += pulse.speed;
        const t = pulse.phase; // 0-1, staggered
        const progress = (pulse.scale + t) % 1; // 0→1 cycle

        // Expand ring
        const s = 1 + progress * (PULSE_MAX_SCALE - 1);
        pulse.mesh.scale.set(s, s, s);

        // Fade out as it expands
        const mat = pulse.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.25 * (1 - progress);
      });
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
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

  // Update pulse rings
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const group = ringsGroupRef.current;

    // Clear old
    pulseRingsRef.current.forEach(p => {
      (p.mesh.geometry as THREE.BufferGeometry).dispose();
      (p.mesh.material as THREE.Material).dispose();
      group.remove(p.mesh);
    });
    pulseRingsRef.current = [];

    // Create new pulse rings for each event
    filteredEvents.forEach((e) => {
      const mag = e.magnitude || 1;
      // Fixed visual size per magnitude — small, proportional, not exaggerated
      const baseRadius = 0.3 + mag * 0.15; // M1=0.45, M3=0.75, M5=1.05
      const radiusUnits = Math.min(baseRadius, 2.0);
      const color = new THREE.Color(DOMAIN_COLORS[e.domain] || '#6b7280');
      const coords = globe.getCoords(e.latitude, e.longitude, 0.001);

      // Multiple staggered pulses per event
      for (let i = 0; i < PULSE_COUNT; i++) {
        const geo = new THREE.RingGeometry(radiusUnits * 0.85, radiusUnits, 48);
        const mat = new THREE.MeshBasicMaterial({
          color: color.clone(),
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(coords);
        mesh.lookAt(0, 0, 0);

        group.add(mesh);
        pulseRingsRef.current.push({
          mesh,
          baseRadius: radiusUnits,
          scale: 0,
          speed: PULSE_SPEED,
          phase: i / PULSE_COUNT, // Stagger: 0, 0.33, 0.67
        });
      }
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
