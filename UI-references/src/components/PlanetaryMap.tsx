import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Radiation, Wind, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Compass, Radio } from 'lucide-react';
import { PlanetaryEvent } from '../types';

interface PlanetaryMapProps {
  events: PlanetaryEvent[];
  selectedEvent: PlanetaryEvent | null;
  onSelectEvent: (event: PlanetaryEvent) => void;
  activeCategories: Set<string>;
}

export default function PlanetaryMap({
  events,
  selectedEvent,
  onSelectEvent,
  activeCategories,
}: PlanetaryMapProps) {
  const [rotation, setRotation] = useState(0);
  const [isRotating, setIsRotating] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [hoveredEvent, setHoveredEvent] = useState<PlanetaryEvent | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);

  // Globe rotation animation loop
  useEffect(() => {
    let lastTime = performance.now();
    const animate = (time: number) => {
      if (isRotating) {
        const delta = time - lastTime;
        setRotation((prev) => (prev + (delta * 0.005)) % 360);
      }
      lastTime = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isRotating]);

  // Handle manual drag rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startRotation = rotation;
    setIsRotating(false);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setRotation((startRotation + deltaX * 0.4) % 360);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Resume rotation slowly after a tiny delay
      setTimeout(() => setIsRotating(true), 2000);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Map 3.5D Coordinates onto a beautiful rotatable sphere
  // Let lat/lon range map: latitude (-90 to 90) and longitude (-180 to 180)
  // Let x/y of event correspond to lat (-60 to 60) and lon (-180 to 180)
  const getGlobeCoordinates = (eventX: number, eventY: number) => {
    // Map event scale (0-100) to latitude and longitude
    const lon = (eventX / 100) * 360 - 180 + rotation;
    const lat = (eventY / 100) * 140 - 70; // Stay away from extreme poles for styling

    // Polar to Cartesian (Globe coordinates)
    const radLon = (lon * Math.PI) / 180;
    const radLat = (lat * Math.PI) / 180;

    const r = 180 * zoom; // Radius of sphere

    // 3D coordinates on unit sphere
    const x3d = r * Math.cos(radLat) * Math.sin(radLon);
    const y3d = -r * Math.sin(radLat);
    const z3d = r * Math.cos(radLat) * Math.cos(radLon); // Positive values are "front" of the globe

    return {
      cx: x3d,
      cy: y3d,
      isVisible: z3d > 0, // Is on front hemisphere
      scale: (z3d + r) / (2 * r) * 0.4 + 0.6, // depth scaling (0.6 to 1.0)
    };
  };

  // Generate sphere grid meridians and parallels
  const getParallelPath = (lat: number) => {
    const radLat = (lat * Math.PI) / 180;
    const r = 180 * zoom; 
    const rParallel = r * Math.cos(radLat);
    const y = -r * Math.sin(radLat);
    // Draw an ellipse representing the parallel rotated by rotation angle
    return `M ${-rParallel} ${y} Q 0 ${y + rParallel * 0.15} ${rParallel} ${y} Q 0 ${y - rParallel * 0.15} ${-rParallel} ${y}`;
  };

  const getMeridianPath = (lonOffset: number) => {
    const absoluteLon = (lonOffset + rotation) % 360;
    const r = 180 * zoom;
    // Simple vertical curved lines mapping
    if (absoluteLon > 90 && absoluteLon < 270) return ''; // Backend of globe
    
    // Calculate curvature based on angle
    const angleRad = (absoluteLon * Math.PI) / 180;
    const xOffset = r * Math.sin(angleRad);
    
    return `M 0 ${-r} Q ${xOffset * 1.3} 0 0 ${r}`;
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'seismic':
        return '#f87171'; // Red
      case 'solar':
        return '#fbbf24'; // Gold
      case 'atmospheric':
        return '#60a5fa'; // Blue
      default:
        return '#ffffff';
    }
  };

  return (
    <div 
      id="planetary-map-container"
      ref={containerRef}
      className="relative flex-1 h-full min-h-[400px] flex flex-col justify-between items-center select-none"
    >
      {/* Main globe visualization area */}
      <div 
        className="relative flex-1 w-full flex items-center justify-center cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        id="globe-viz-stage"
      >
        {/* Intense, beautiful planetary halo glow behind the interactive globe */}
        <div className="absolute w-[450px] h-[450px] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18),rgba(99,102,241,0.08),transparent_70%)] rounded-full blur-3xl opacity-80 pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />

        <svg 
          width="480" 
          height="480" 
          viewBox="-240 -240 480 480"
          className="overflow-visible pointer-events-none"
        >
          {/* Defs for gradients, patterns */}
          <defs>
            <radialGradient id="sphereGrad" cx="50%" cy="50%" r="50%">
              <stop offset="65%" stopColor="#000000" stopOpacity="0" />
              <stop offset="92%" stopColor="#0a0f1d" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.25" />
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Spherical Grid Backing (Latitude Circles) with realistic glow and color */}
          <g stroke="rgba(56, 189, 248, 0.12)" strokeWidth="0.75" fill="none">
            {[-60, -45, -30, -15, 0, 15, 30, 45, 60].map((lat) => (
              <path key={`lat-${lat}`} d={getParallelPath(lat)} />
            ))}
            {/* Longitude meridians */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((lon) => {
              const pathD = getMeridianPath(lon);
              return pathD ? <path key={`lon-${lon}`} d={pathD} stroke="rgba(99, 102, 241, 0.12)" /> : null;
            })}
          </g>

          {/* Outer Ring Compass / Coordinates */}
          <circle 
            r={200 * zoom} 
            fill="none" 
            stroke="rgba(255, 255, 255, 0.06)" 
            strokeWidth="1.5" 
            strokeDasharray="4,8" 
          />
          <circle 
            r={180 * zoom} 
            fill="none" 
            stroke="rgba(255, 255, 255, 0.08)" 
            strokeWidth="0.75" 
          />

          {/* Outer Degree Ticks */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 15 * Math.PI) / 180;
            const r1 = 200 * zoom;
            const r2 = 205 * zoom;
            const x1 = r1 * Math.cos(angle);
            const y1 = r1 * Math.sin(angle);
            const x2 = r2 * Math.cos(angle);
            const y2 = r2 * Math.sin(angle);
            
            return (
              <line
                key={`tick-${i}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={i % 6 === 0 ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.06)"}
                strokeWidth={i % 6 === 0 ? 1.5 : 0.75}
              />
            );
          })}

          {/* Sphere Shading Overlay */}
          <circle r={180 * zoom} fill="url(#sphereGrad)" />

          {/* Plotting active events */}
          <g id="globe-events">
            {events
              .filter(event => activeCategories.has(event.type))
              .map((event) => {
                const { cx, cy, isVisible, scale } = getGlobeCoordinates(event.x, event.y);
                if (!isVisible) return null;

                const isSelected = selectedEvent?.id === event.id;
                const isHovered = hoveredEvent?.id === event.id;
                const color = getEventColor(event.type);
                const pointRadius = (isSelected ? 7 : isHovered ? 5.5 : 3.5) * scale;

                return (
                  <g 
                    key={event.id}
                    className="cursor-pointer pointer-events-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                    onMouseEnter={() => setHoveredEvent(event)}
                    onMouseLeave={() => setHoveredEvent(null)}
                  >
                    {/* Animated Pulsing Radar Rings */}
                    <AnimatePresence>
                      {(isSelected || isHovered) && (
                        <motion.circle
                          cx={cx}
                          cy={cy}
                          r={pointRadius * 7}
                          fill="none"
                          stroke={color}
                          strokeWidth="1"
                          initial={{ opacity: 0.6, scale: 0.2 }}
                          animate={{ opacity: 0, scale: 1.2 }}
                          exit={{ opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Outer glow aura for seismic, solar flare, or winds */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={pointRadius * 2.8}
                      fill={color}
                      fillOpacity={isSelected ? 0.35 : isHovered ? 0.25 : 0.08}
                      stroke={color}
                      strokeOpacity={isSelected ? 0.6 : isHovered ? 0.4 : 0.15}
                      strokeWidth="1"
                    />

                    {/* Solid Event Center marker */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={pointRadius}
                      fill={color}
                      filter="url(#glow)"
                      className="transition-all duration-300"
                    />

                    {/* Small tag identifier text when hovered or selected */}
                    {(isSelected || isHovered) && (
                      <g className="pointer-events-none">
                        <rect
                          x={cx + 12}
                          y={cy - 14}
                          width="120"
                          height="28"
                          rx="6"
                          fill="rgba(10, 10, 10, 0.85)"
                          stroke="rgba(255, 255, 255, 0.08)"
                          strokeWidth="1"
                        />
                        <text
                          x={cx + 20}
                          y={cy + 4}
                          fill="#ffffff"
                          fontSize="9"
                          fontFamily="Geist"
                          fontWeight="600"
                        >
                          {event.title}
                        </text>
                        {/* Event Location abbreviation */}
                        <text
                          x={cx + 20}
                          y={cy + 14}
                          fill="rgba(255, 255, 255, 0.4)"
                          fontSize="7"
                          fontFamily="JetBrains Mono"
                        >
                          {event.location.length > 20 ? event.location.substring(0, 18) + '..' : event.location}
                        </text>

                        {/* Anchor Line projection */}
                        <line 
                          x1={cx}
                          y1={cy}
                          x2={cx + 12}
                          y2={cy}
                          stroke="rgba(255, 255, 255, 0.2)"
                          strokeWidth="0.5"
                          strokeDasharray="2,2"
                        />
                      </g>
                    )}
                  </g>
                );
              })}
          </g>
        </svg>
      </div>

      {/* Control overlay at the bottom right of the screen (floating with z-40) */}
      <div className="fixed bottom-12 right-12 z-40 flex items-center gap-2 bg-white/[0.03] backdrop-blur-3xl px-4 py-2 rounded-full border border-white/5 text-zinc-500 shadow-2xl" id="map-actions-dock">
        <button
          onClick={() => setZoom(prev => Math.min(prev + 0.1, 1.5))}
          title="Zoom In"
          className="p-1 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.8))}
          title="Zoom Out"
          className="p-1 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            setRotation(0);
            setZoom(1);
          }}
          title="Reset View"
          className="p-1 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <span className="w-px h-3.5 bg-white/10 mx-1" />
        <button
          onClick={() => setIsRotating(!isRotating)}
          title={isRotating ? "Lock Rotation" : "Auto-Rotate"}
          className={`p-1 transition-colors cursor-pointer ${isRotating ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-200"}`}
        >
          <Compass className="w-3.5 h-3.5 animate-spin-slow" />
        </button>
      </div>
    </div>
  );
}
