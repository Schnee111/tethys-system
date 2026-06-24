import { useRef, useEffect, useState, useMemo, Suspense } from 'react';
import * as THREE from 'three';
import { Canvas, extend, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { useDataStore } from '../../stores/dataStore';
import { useGlobeStore } from '../../stores/globeStore';
import { DOMAIN_COLORS } from '../../utils/colors';
import { AtmosphereMaterial } from './EarthShader';
import gsap from 'gsap';

// Register the custom shader material in R3F
extend({ AtmosphereMaterial });

const GLOBE_RADIUS = 2.0;
const FLY_DURATION = 2.0; // 2 seconds GSAP transition

// Helper to convert geographic coordinates (lat, lon) to Cartesian 3D coordinates (x, y, z)
function convertCoords(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.sin(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.cos(theta);

  return [x, y, z];
}

// Custom handler to animate camera moves sinematically using GSAP
function CameraHandler({ controlsRef }: { controlsRef: any }) {
  const { camera } = useThree();
  const selectedEvent = useGlobeStore((state) => state.selectedEvent);
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    if (selectedEvent) {
      isTransitioningRef.current = true;
      const [x, y, z] = convertCoords(selectedEvent.latitude, selectedEvent.longitude, 3.2); // Closer zoom on target

      gsap.to(camera.position, {
        x,
        y,
        z,
        duration: FLY_DURATION,
        ease: 'power2.inOut',
        onUpdate: () => {
          camera.lookAt(0, 0, 0);
          if (controlsRef.current) {
            controlsRef.current.update();
          }
        },
        onComplete: () => {
          isTransitioningRef.current = false;
        }
      });
    } else {
      isTransitioningRef.current = true;
      gsap.to(camera.position, {
        x: 0,
        y: 0,
        z: 5.5,
        duration: 1.5,
        ease: 'power2.inOut',
        onUpdate: () => {
          camera.lookAt(0, 0, 0);
          if (controlsRef.current) {
            controlsRef.current.update();
          }
        },
        onComplete: () => {
          isTransitioningRef.current = false;
        }
      });
    }
  }, [selectedEvent, camera, controlsRef]);

  return null;
}

// Pulse ring component to animate circles around event epicenter
function PulseRing({ event, color, isSelected }: { event: any; color: string; isSelected: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => convertCoords(event.latitude, event.longitude, GLOBE_RADIUS + 0.005), [event.latitude, event.longitude]);
  const mag = event.magnitude || 1;
  const radius = 0.05 + mag * 0.02;

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.lookAt(0, 0, 0);
    }
  }, [pos]);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const elapsed = clock.getElapsedTime();
    const duration = isSelected ? 1.5 : 2.5;
    const progress = (elapsed / duration) % 1;

    const scale = 1 + progress * (isSelected ? 2.5 : 1.8);
    meshRef.current.scale.set(scale, scale, scale);

    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = (isSelected ? 0.65 : 0.4) * (1 - progress);
  });

  return (
    <mesh ref={meshRef} position={pos}>
      <ringGeometry args={[radius * 0.85, radius, 32]} />
      <meshBasicMaterial color={color} transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// Marker component representing either Volcano (Torus) or Earthquake (Sphere)
interface MarkerProps {
  event: any;
  color: string;
  isSelected: boolean;
  opacity: number;
  size: number;
  onHover: (event: any, x: number, y: number) => void;
  onHoverOut: () => void;
  onClick: (event: any) => void;
}

function Marker({ event, color, isSelected, opacity, size, onHover, onHoverOut, onClick }: MarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => convertCoords(event.latitude, event.longitude, GLOBE_RADIUS + 0.01), [event.latitude, event.longitude]);

  const geometry = useMemo(() => {
    if (event.domain === 'volcanic') {
      return new THREE.TorusGeometry(size, size * 0.3, 8, 16);
    }
    return new THREE.SphereGeometry(size, 16, 16);
  }, [event.domain, size]);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.lookAt(0, 0, 0);
      if (event.domain === 'volcanic') {
        meshRef.current.rotateX(Math.PI / 2); // Lay flat on Earth's surface
      }
    }
    if (ringRef.current) {
      ringRef.current.lookAt(0, 0, 0);
    }
  }, [pos, event.domain]);

  return (
    <group position={pos}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
          onHover(event, e.clientX, e.clientY);
        }}
        onPointerOut={(e) => {
          document.body.style.cursor = 'default';
          onHoverOut();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick(event);
        }}
      >
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>

      {isSelected && (
        <mesh ref={ringRef}>
          <ringGeometry args={[size * 1.8, size * 2.2, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

// Realistic Earth globe mesh with texture maps
function EarthModel() {
  const colorMap = useLoader(THREE.TextureLoader, 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
  const bumpMap = useLoader(THREE.TextureLoader, 'https://unpkg.com/three-globe/example/img/earth-topology.png');

  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      <meshPhongMaterial
        map={colorMap}
        bumpMap={bumpMap}
        bumpScale={0.08}
        specular={new THREE.Color('#111')}
        shininess={5}
      />
    </mesh>
  );
}

// Atmosphere glowing layer wrapping the Earth
function AtmosphereModel() {
  const materialRef = useRef<any>(null);

  return (
    <mesh scale={[1.12, 1.12, 1.12]}>
      <sphereGeometry args={[GLOBE_RADIUS, 32, 32]} />
      <atmosphereMaterial
        ref={materialRef}
        transparent
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

export function TethysGlobe() {
  const controlsRef = useRef<any>(null);
  const { events } = useDataStore();
  const { activeCategories, minMagnitude, maxMagnitude, timelinePercent, selectedEvent, setSelectedEvent, setAltitude } = useGlobeStore();
  const [hoveredEvent, setHoveredEvent] = useState<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Altitude tracking inside OrbitControls change
  const handleControlsChange = () => {
    if (controlsRef.current) {
      const dist = controlsRef.current.object.position.distanceTo(new THREE.Vector3(0, 0, 0));
      const alt = (dist - GLOBE_RADIUS) / GLOBE_RADIUS;
      setAltitude(alt);
    }
  };

  const filteredEvents = useMemo(() => {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours default
    const base = events.filter(e => {
      if (!activeCategories.has(e.domain)) return false;
      if (e.magnitude != null) {
        if (e.magnitude < minMagnitude) return false;
        if (e.magnitude > maxMagnitude) return false;
      }
      return new Date(e.time).getTime() >= cutoffTime;
    });

    if (selectedEvent) {
      const exists = base.some(e => e.event_id === selectedEvent.event_id);
      if (!exists) {
        base.unshift(selectedEvent);
      }
    }

    return base;
  }, [events, activeCategories, minMagnitude, maxMagnitude, selectedEvent]);

  const markers = useMemo(() => filteredEvents.map((e) => {
    const isSelected = selectedEvent?.event_id === e.event_id && selectedEvent?.time === e.time;
    const hasSelection = selectedEvent != null;
    const mag = e.magnitude || 1;

    const opacity = hasSelection ? (isSelected ? 1.0 : 0.25) : 0.9;
    const sizeMultiplier = isSelected ? 1.4 : 1.0;

    return {
      event: e,
      isSelected,
      opacity,
      size: Math.max(0.03, mag * 0.015) * sizeMultiplier,
      color: DOMAIN_COLORS[e.domain] || '#6b7280',
    };
  }), [filteredEvents, selectedEvent]);

  const handleHover = (event: any, x: number, y: number) => {
    setHoveredEvent(event);
    setTooltipPos({ x, y });
  };

  const handleHoverOut = () => {
    setHoveredEvent(null);
  };

  const handleMarkerClick = (event: any) => {
    if (selectedEvent?.event_id === event.event_id) {
      setSelectedEvent(null); // Unselect
    } else {
      setSelectedEvent(event); // Select and trigger camera zoom
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100vw', height: '100vh', background: '#050a0f', overflow: 'hidden' }}>
      <Suspense fallback={<div className="flex h-full w-full items-center justify-center font-mono text-xs text-amber-500 uppercase tracking-widest">Loading Tethys Planet...</div>}>
        <Canvas camera={{ position: [0, 0, 5.5], fov: 45, near: 0.1, far: 100 }}>
          <ambientLight intensity={0.15} />
          <directionalLight position={[5, 3, 5]} intensity={1.5} />
          
          <Stars radius={60} depth={30} count={3500} factor={3} saturation={0} fade speed={0.5} />
          
          <group>
            <EarthModel />
            <AtmosphereModel />

            {/* Event Markers & Pulse Epicenter Rings */}
            {markers.map((m) => (
              <group key={`${m.event.event_id}-${m.event.time}`}>
                <Marker
                  event={m.event}
                  color={m.color}
                  isSelected={m.isSelected}
                  opacity={m.opacity}
                  size={m.size}
                  onHover={handleHover}
                  onHoverOut={handleHoverOut}
                  onClick={handleMarkerClick}
                />
                <PulseRing
                  event={m.event}
                  color={m.color}
                  isSelected={m.isSelected}
                />
              </group>
            ))}
          </group>

          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minDistance={2.4}
            maxDistance={12}
            autoRotate={!selectedEvent}
            autoRotateSpeed={0.4}
            onChange={handleControlsChange}
          />
          
          <CameraHandler controlsRef={controlsRef} />
        </Canvas>
      </Suspense>

      {/* Dynamic Hover Tooltip Card (Custom HTML HUD style) */}
      {hoveredEvent && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x + 15,
            top: tooltipPos.y + 15,
            pointerEvents: 'none',
            background: 'rgba(10, 22, 40, 0.85)',
            border: '1px solid rgba(245, 166, 35, 0.4)',
            borderRadius: '4px',
            padding: '8px 12px',
            color: '#e0e6ed',
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            letterSpacing: '0.05em',
            zIndex: 100,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            whiteSpace: 'pre-line',
          }}
        >
          <span style={{ color: DOMAIN_COLORS[hoveredEvent.domain], fontWeight: 700, textTransform: 'uppercase' }}>
            {hoveredEvent.domain}
          </span>
          {hoveredEvent.magnitude != null && ` · M${hoveredEvent.magnitude.toFixed(1)}`}
          {`\n${hoveredEvent.location || 'Unknown location'}`}
          {hoveredEvent.depth_km != null && `\nDepth: ${hoveredEvent.depth_km.toFixed(1)}km`}
          {`\nTime: ${new Date(hoveredEvent.time).toLocaleTimeString()}`}
        </div>
      )}
    </div>
  );
}
