import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';
import Globe from 'react-globe.gl';
import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';
import { DOMAIN_COLORS } from '../utils/colors';

const GLOBE_HOURS = 2;
const FLY_ALTITUDE = 0.3; // Very close zoom when focused
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
  phase: number;
  maxOpacity: number;
}

export function EarthGlobe() {
  const globeRef = useRef<any>(null);
  const { events } = useDataStore();
  const { activeCategories, minMagnitude, maxMagnitude, timelinePercent, selectedEvent, setAltitude } = useGlobeStore();
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
    // Initial view — not too far
    globe.pointOfView({ altitude: 2.0 }, 0);
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
        mat.opacity = pulse.maxOpacity * (1 - progress);
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

  // Poll altitude for dynamic glass opacity
  useEffect(() => {
    let raf: number;
    let lastAlt = -1;
    const poll = () => {
      const globe = globeRef.current;
      if (globe) {
        try {
          const pov = globe.pointOfView();
          const alt = pov?.altitude;
          if (typeof alt === 'number' && alt !== lastAlt) {
            lastAlt = alt;
            setAltitude(alt);
          }
        } catch {}
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [setAltitude]);

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
      // Zoom back to initial view + resume rotation
      setTimeout(() => {
        if (globeRef.current && !prevEventIdRef.current) {
          globeRef.current.pointOfView({ altitude: 2.0 }, 800);
          globeRef.current.controls().autoRotate = true;
          globeRef.current.controls().autoRotateSpeed = 0.15;
        }
      }, 300);
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
      const baseRadius = 0.3 + mag * 0.15;
      const radiusUnits = Math.min(baseRadius, 2.0);
      const isSelected = selectedEvent?.event_id === e.event_id && selectedEvent?.time === e.time;
      const color = isSelected
        ? new THREE.Color('#ffffff')
        : new THREE.Color(DOMAIN_COLORS[e.domain] || '#6b7280');
      const coords = globe.getCoords(e.latitude, e.longitude, 0.001);
      const pulseCount = isSelected ? 5 : PULSE_COUNT; // More pulses for selected
      const maxOpacity = isSelected ? 0.4 : 0.25; // Brighter for selected

      for (let i = 0; i < pulseCount; i++) {
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
          speed: isSelected ? PULSE_SPEED * 1.3 : PULSE_SPEED, // Slightly faster for selected
          phase: i / pulseCount,
          maxOpacity,
        });
      }
    });
  }, [filteredEvents, selectedEvent]);

  // Pillar lines
  const points = filteredEvents.map((e) => ({
    lat: e.latitude,
    lng: e.longitude,
    altitude: 0.01 + (e.magnitude || 1) * 0.004,
    size: 0.03,
    color: DOMAIN_COLORS[e.domain] || '#6b7280',
  }));

  // Marker spheres — selected one is bigger + highlighted
  const markers = filteredEvents.map((e) => {
    const isSelected = selectedEvent?.event_id === e.event_id && selectedEvent?.time === e.time;
    const mag = e.magnitude || 1;
    return {
      lat: e.latitude,
      lng: e.longitude,
      alt: 0.01 + mag * 0.004,
      size: isSelected ? Math.max(0.3, mag * 0.08) : Math.max(0.15, mag * 0.05),
      color: isSelected ? '#ffffff' : (DOMAIN_COLORS[e.domain] || '#6b7280'),
      isSelected,
      label: `${e.domain.toUpperCase()} — M${e.magnitude?.toFixed(1) || '?'}\n${e.location}\nDepth: ${e.depth_km?.toFixed(1) || '?'}km`,
    };
  });

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
      objectThreeObject={(d: any) => {
        const group = new THREE.Group();

        // Main sphere
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(d.size, 16, 16),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(d.color),
            transparent: true,
            opacity: d.isSelected ? 1.0 : 0.95,
          })
        );
        group.add(sphere);

        // Selected marker gets a bright glow ring
        if (d.isSelected) {
          const glow = new THREE.Mesh(
            new THREE.RingGeometry(d.size * 1.5, d.size * 2.2, 32),
            new THREE.MeshBasicMaterial({
              color: new THREE.Color('#ffffff'),
              transparent: true,
              opacity: 0.3,
              side: THREE.DoubleSide,
            })
          );
          group.add(glow);
        }

        return group;
      }}
    />
  );
}
