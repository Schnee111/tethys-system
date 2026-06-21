# TETHYS — Phase 3 Technical Specification: 3D Globe Dashboard

## Overview

Phase 3 builds the interactive 3D globe dashboard — the visual heart of Tethys. This is where data becomes experience. A living Earth that shows real-time planetary activity, with the ability to explore, zoom, filter, and understand.

**Duration:** 4 weeks (largest phase)
**Prerequisite:** Phase 1 (data flowing) + Phase 2 (analysis running)
**Goal:** Interactive 3D globe with real-time data overlays, fully deployed

---

## Tech Stack

```
FRAMEWORK           TECHNOLOGY          WHY
──────────────────  ──────────────────  ──────────────────────────
UI Framework        React 18 + TSX      Mature, type-safe, ecosystem
3D Globe            globe.gl            Best data viz globe lib
                   (Three.js wrapper)   Built on Three.js, high perf
State Management    Zustand             Lightweight, no boilerplate
Styling             Tailwind CSS        Dark theme, utility-first
Build Tool          Vite                Fast HMR, modern
HTTP Client         axios               Simple, interceptors
WebSocket           Native WS API       Real-time updates
Charts              Recharts            Lightweight, React-native
Hosting             Cloudflare Pages    Free, global CDN, HTTPS
```

---

## Project Structure

```
frontend/
├── public/
│   └── textures/          # Earth textures, bump maps, clouds
├── src/
│   ├── components/
│   │   ├── Globe/
│   │   │   ├── EarthGlobe.tsx        # Main globe component
│   │   │   ├── SeismicLayer.tsx      # Earthquake pulses
│   │   │   ├── SolarWindLayer.tsx    # Particle streams
│   │   │   ├── GOESLayer.tsx         # X-ray/proton overlay
│   │   │   ├── CorrelationArcs.tsx   # Connection lines
│   │   │   ├── AtmosphereLayer.tsx   # Weather heatmaps
│   │   │   └── NightLights.tsx       # City lights on dark side
│   │   ├── Panels/
│   │   │   ├── EventDetail.tsx       # Click event → detail panel
│   │   │   ├── AnomalyFeed.tsx       # Live anomaly stream
│   │   │   ├── ThreatLevel.tsx       # Threat assessment display
│   │   │   └── TimeScrubber.tsx      # Rewind/fast-forward
│   │   ├── Sidebar/
│   │   │   ├── LayerToggle.tsx       # Toggle data layers
│   │   │   ├── FilterPanel.tsx       # Filter by type/magnitude
│   │   │   └── SearchBar.tsx         # Location search
│   │   ├── Tethys/
│   │   │   ├── TethysSpeaks.tsx      # AI narrative feed
│   │   │   └── TethysStatus.tsx      # System health
│   │   └── Layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── MainView.tsx
│   ├── hooks/
│   │   ├── useWebSocket.ts           # WS connection management
│   │   ├── useGlobeControls.ts       # Camera, zoom, rotation
│   │   └── useTimeScrubber.ts        # Time travel logic
│   ├── stores/
│   │   ├── globeStore.ts             # Globe state (layers, filters)
│   │   ├── dataStore.ts              # Real-time data cache
│   │   └── analysisStore.ts          # Anomalies, correlations
│   ├── api/
│   │   ├── client.ts                 # Axios instance + interceptors
│   │   ├── events.ts                 # Event query endpoints
│   │   └── analysis.ts               # Analysis endpoints
│   ├── types/
│   │   ├── seismic.ts
│   │   ├── solar.ts
│   │   ├── atmospheric.ts
│   │   └── analysis.ts
│   ├── utils/
│   │   ├── colors.ts                 # Severity color mapping
│   │   ├── formatters.ts             # Number/date formatting
│   │   └── constants.ts              # Thresholds, limits
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Globe Component Architecture

### Main Globe (EarthGlobe.tsx)

```tsx
import Globe from 'react-globe.gl';
import { useDataStore, useGlobeStore } from '../stores';

export function EarthGlobe() {
  const globeRef = useRef();
  const { layers, selectedEvent, timeRange, isLive } = useGlobeStore();
  
  // CRITICAL: Don't subscribe to high-frequency WebSocket data via Zustand.
  // If WebSocket pushes every 1s, Zustand state change triggers React re-render
  // of the entire EarthGlobe component (including Three.js canvas) every 1s.
  // This causes frame drops from 60fps to <10fps.
  //
  // Solution: Use useRef for fast-flowing data. Mutate Three.js objects
  // imperatively inside requestAnimationFrame, NOT via React props.
  
  const seismicDataRef = useRef([]);
  const solarWindRef = useRef([]);
  const correlationsRef = useRef([]);
  
  // Subscribe to data store WITHOUT triggering re-renders
  useEffect(() => {
    const unsubSeismic = useDataStore.subscribe(
      state => {
        seismicDataRef.current = state.seismicEvents;
      }
    );
    const unsubSolar = useDataStore.subscribe(
      state => {
        solarWindRef.current = state.solarWind;
      }
    );
    const unsubCorr = useDataStore.subscribe(
      state => {
        correlationsRef.current = state.correlations;
      }
    );
    return () => {
      unsubSeismic();
      unsubSolar();
      unsubCorr();
    };
  }, []);
  
  // Imperative render loop — updates Three.js directly, no React re-render
  // CRITICAL: requestAnimationFrame is ONLY for camera rotation or
  // direct Three.js mesh manipulation (mesh.position.set()).
  // .pointsData() and .arcsData() are EXPENSIVE — they rebuild
  // Three.js geometries. Calling them 60fps = browser freeze.
  //
  // Solution: Only call .pointsData() when WebSocket data changes.
  // requestAnimationFrame handles smooth camera rotation only.
  //
  // Source: Gemini Review — "Penyiksaan Render Loop Globe.gl"
  
  // Update globe data ONLY when ref changes (WebSocket event)
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    
    // Subscribe to data changes — .pointsData() called ONCE per change
    const unsubSeismic = useDataStore.subscribe(
      state => state.seismicEvents,
      (seismicEvents) => {
        if (layers.seismic) {
          globe.pointsData(seismicEvents);  // Called once per WS event
        }
      }
    );
    const unsubCorr = useDataStore.subscribe(
      state => state.correlations,
      (correlations) => {
        if (layers.correlations) {
          globe.arcsData(correlations);  // Called once per WS event
        }
      }
    );
    
    return () => {
      unsubSeismic();
      unsubCorr();
    };
  }, [layers]);
  
  return (
    <Globe
      ref={globeRef}
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
      showAtmosphere={true}
      atmosphereColor="rgba(100, 150, 255, 0.3)"
      atmosphereAltitude={0.15}
      
      // Initial data (subsequent updates via imperative renderLoop)
      pointsData={[]}
      pointLat="latitude"
      pointLng="longitude"
      pointAltitude={0.01}
      pointColor={d => severityColor(d.magnitude)}
      pointRadius={d => magnitudeToRadius(d.magnitude)}
      onPointClick={d => setSelectedEvent(d)}
      
      arcsData={[]}
      arcStartLat="lat_a"
      arcStartLng="lon_a"
      arcEndLat="lat_b"
      arcEndLng="lon_b"
      arcColor={d => d.is_significant ? '#ff6b35' : '#4a9eff'}
      arcDashLength={0.4}
      arcDashGap={0.2}
      arcDashAnimateTime={1500}
      
      labelsData={layers.labels ? majorEvents : []}
      labelLat="latitude"
      labelLng="longitude"
      labelText="label"
      labelSize={1.5}
      labelColor={() => '#ffffff'}
    />
  );
}
```

### Seismic Layer — Pulse Effect

```tsx
function SeismicLayer({ events, onEventClick }) {
  // Each earthquake appears as a glowing pulse
  // Size = magnitude, color = severity, animation = ripple
  
  const points = events.map(e => ({
    lat: e.latitude,
    lng: e.longitude,
    size: Math.pow(10, e.magnitude / 3) * 0.01,  // Exponential scaling
    color: severityGradient(e.magnitude),
    altitude: 0.01,
    // Pulse animation via custom shader or CSS
  }));
  
  return (
    <Globe
      pointsData={points}
      pointColor="color"
      pointRadius="size"
      pointAltitude="altitude"
      onPointClick={onEventClick}
      // Custom point material for glow effect
      pointThreeObject={d => createPulseMesh(d)}
    />
  );
}
```

### Solar Wind Layer — Particle Streams

```tsx
function SolarWindLayer({ solarData }) {
  // Solar wind particles flow from sun direction toward Earth
  // Density = particle count, speed = animation speed
  
  const sunDirection = calculateSunPosition(); // Based on current time
  const particles = generateParticleStream(sunDirection, solarData);
  
  return (
    <Globe
      customLayerData={particles}
      customThreeObject={d => createParticle(d)}
      customThreeObjectUpdate={(obj, d) => updateParticle(obj, d)}
    />
  );
}
```

---

## Time Scrubber

```tsx
function TimeScrubber() {
  const { timeRange, setTimeRange, isPlaying, setPlaying } = useGlobeStore();
  const [speed, setSpeed] = useState(1); // 1x, 10x, 100x
  const [isLive, setIsLive] = useState(true);
  
  // RACE CONDITION FIX:
  // When user scrubs to past, WebSocket still sends live events.
  // Globe would show mixed historical + real-time data = confusing.
  // Solution: Buffer WebSocket events when not in LIVE mode.
  // Flush buffer when user clicks LIVE.
  
  // RAM SAFETY: Buffer is capped at 5000 events (ring buffer).
  // If user leaves tab open while scrubbing for hours, oldest events
  // are discarded to prevent browser Out of Memory crash.
  const MAX_BUFFER_SIZE = 5000;
  
  const handleWSEvent = (event: WSEvent) => {
    if (isLive) {
      // Live mode: display immediately
      addDisplayEvent(event);
    } else {
      // Historical mode: buffer with cap
      setBufferedEvents(prev => {
        const next = [...prev, event];
        if (next.length > MAX_BUFFER_SIZE) {
          next.shift();  // Discard oldest to prevent RAM bomb
        }
        return next;
      });
    }
  };
  
  const handleScrub = (timestamp: number) => {
    setIsLive(false);  // Switch to historical mode
    setTimeRange({ end: timestamp });
    // WebSocket events are now buffered, not displayed
  };
  
  const handleLive = () => {
    setIsLive(true);   // Switch to live mode
    setTimeRange({ end: Date.now() });
    // Flush buffered events, display real-time
  };
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/90 p-4">
      <div className="flex items-center gap-4">
        {/* Time range slider */}
        <input
          type="range"
          min={Date.now() - 7 * 24 * 60 * 60 * 1000}  // 7 days ago
          max={Date.now()}
          value={timeRange.end}
          onChange={e => handleScrub(+e.target.value)}
          className="flex-1"
        />
        
        {/* Play/Pause */}
        <button onClick={() => setPlaying(!isPlaying)}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        
        {/* Speed controls */}
        <div className="flex gap-2">
          {[1, 10, 100].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={speed === s ? 'text-blue-400' : 'text-gray-500'}
            >
              {s}x
            </button>
          ))}
        </div>
        
        {/* Time display */}
        <span className="text-gray-300 font-mono">
          {new Date(timeRange.end).toISOString()}
        </span>
        
        {/* Live button — only active when scrubbing */}
        <button 
          onClick={handleLive}
          className={isLive ? 'text-green-400' : 'text-gray-500'}
        >
          ● LIVE {isLive ? '(active)' : '(click to resume)'}
        </button>
      </div>
    </div>
  );
}
```

---

## Anomaly Feed

```tsx
function AnomalyFeed() {
  const { anomalies } = useAnalysisStore();
  
  return (
    <div className="w-80 max-h-96 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-2">⚡ Anomaly Feed</h3>
      {anomalies.map(a => (
        <div
          key={a.anomaly_id}
          className="p-3 mb-2 rounded-lg bg-gray-800/50 border-l-4"
          style={{ borderColor: severityColor(a.severity) }}
        >
          <div className="flex justify-between">
            <span className="font-medium">{a.domain}</span>
            <span className="text-xs text-gray-400">
              {formatTime(a.time)}
            </span>
          </div>
          <p className="text-sm text-gray-300 mt-1">
            {a.metric}: {a.value.toFixed(2)} (z={a.z_score.toFixed(1)})
          </p>
          <p className="text-xs text-gray-500 mt-1">{a.description}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Tethys Speaks — AI Narrative

```tsx
function TethysSpeaks() {
  const { latestAssessment } = useAnalysisStore();
  
  if (!latestAssessment) return null;
  
  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-2xl">
      <div className="bg-gray-900/90 rounded-lg p-4 border border-blue-500/30">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-blue-400">🧠</span>
          <span className="text-sm font-medium text-blue-400">
            TETHYS OBSERVES
          </span>
        </div>
        <p className="text-gray-200 text-sm leading-relaxed">
          {latestAssessment.summary}
        </p>
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
          <span>Threat: {latestAssessment.activity_level}</span>
          <span>Anomalies: {latestAssessment.active_anomalies}</span>
          <span>Correlations: {latestAssessment.active_correlations}</span>
        </div>
      </div>
    </div>
  );
}
```

---

## Color Schemes

```typescript
// Severity colors (dark theme)
const SEVERITY_COLORS = {
  nominal:   '#10b981',  // Green
  low:       '#3b82f6',  // Blue
  medium:    '#f59e0b',  // Amber
  high:      '#ef4444',  // Red
  critical:  '#dc2626',  // Dark red
};

// Magnitude gradient (earthquakes)
function severityColor(magnitude: number): string {
  if (magnitude >= 7.0) return '#dc2626';
  if (magnitude >= 6.0) return '#ef4444';
  if (magnitude >= 5.0) return '#f59e0b';
  if (magnitude >= 4.0) return '#3b82f6';
  return '#10b981';
}

// Threat level gradient
function threatColor(level: string): string {
  return SEVERITY_COLORS[level] || '#6b7280';
}
```

---

## WebSocket Integration

```typescript
// hooks/useWebSocket.ts
export function useWebSocket() {
  const { addEvent, updateThreat } = useDataStore();
  const wsRef = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    const ws = new WebSocket(`wss://${API_HOST}/ws/live`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'seismic':
          addEvent('seismic', data.data);
          break;
        case 'solar_wind':
          addEvent('solar_wind', data.data);
          break;
        case 'goes':
          addEvent('goes', data.data);
          break;
        case 'threat_assessment':
          updateThreat(data.data);
          break;
        case 'anomaly':
          addEvent('anomaly', data.data);
          break;
      }
    };
    
    ws.onclose = () => {
      // Reconnect after 3 seconds
      setTimeout(() => connect(), 3000);
    };
    
    wsRef.current = ws;
    return () => ws.close();
  }, []);
}
```

---

## Responsive Design

```
BREAKPOINT    LAYOUT
────────────  ──────────────────────────────────────
< 768px       Globe full screen, bottom sheet panels
768-1024px    Globe + right sidebar (collapsible)
> 1024px      Globe + left sidebar + right panels
> 1440px      Full layout with all panels visible
```

## WebGL Detection & Mobile Fallback (CRITICAL)

globe.gl uses WebGL. Low-end Android devices (Mali-400, Adreno 302)
frequently fail WebGL initialization. Without fallback, page is blank.

```typescript
// utils/webglSupport.ts
export function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

// In App.tsx:
function App() {
  const webglSupported = isWebGLSupported();
  
  if (!webglSupported) {
    return <FallbackMap2D />;  // Leaflet-based 2D map
  }
  
  return <EarthGlobe />;
}

// Mobile optimization: reduce point count
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
const MAX_POINTS = isMobile ? 500 : 10000;
const ENABLE_PARTICLES = !isMobile;
```

## 2D Fallback (Leaflet)

```tsx
// components/Fallback/FallbackMap2D.tsx
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';

export function FallbackMap2D({ events }) {
  return (
    <MapContainer center={[0, 0]} zoom={2} style={{ height: '100vh' }} data-testid="fallback-map">
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      {events.map(event => (
        <CircleMarker
          key={event.id}
          center={[event.latitude, event.longitude]}
          radius={event.magnitude || 2}
          fillColor={severityColor(event.severity)}
          fillOpacity={0.7}
        >
          <Popup>{event.place}</Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
```

---

## Performance Targets

```
METRIC                    TARGET
────────────────────────  ──────────
Initial load              < 3 seconds
Globe render (1K points)  60 fps
Globe render (10K points) 30 fps
WebSocket latency         < 100ms
Time scrubber response    < 200ms
Memory usage              < 500MB
WebGL memory              < 300MB (must monitor)
```

---

## Three.js Memory Management (CRITICAL)

### The Problem

Three.js does NOT auto-dispose WebGL resources. Every mesh, geometry,
material, and texture you create stays in GPU VRAM until you explicitly
call `.dispose()`. With WebSocket pushing updates every minute, orphaned
objects accumulate and crash the browser tab within 2 hours.

Source: threejs.org/docs/pages/BufferGeometry.html — "Disposes of the
geometry and releases its resources. This should be called when the
geometry is no longer needed to free up GPU memory."

Source: threejs.org/docs/pages/Material.html — "The .dispose() method
frees GPU-related resources allocated by the material instance."

### Solution: Object Pool + Lifecycle Management

```typescript
// THREE.js memory management — MUST IMPLEMENT
// Object Pool pattern: reuse meshes, don't create/dispose on every update.
// dispose() is called ONLY on app unmount, NOT during data updates.
//
// Source: threejs.org/docs/pages/BufferGeometry.html
// "Disposes of the geometry and releases its resources."

class ObjectPool<T extends THREE.Object3D> {
  private pool: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;
  
  constructor(factory: () => T) {
    this.factory = factory;
  }
  
  acquire(): T {
    let obj = this.pool.pop();
    if (!obj) {
      obj = this.factory();
    }
    obj.visible = true;  // Make visible again
    this.active.add(obj);
    return obj;
  }
  
  release(obj: T): void {
    // Do NOT dispose — hide and return to pool for reuse
    obj.visible = false;
    obj.position.set(0, 0, 0);  // Reset position
    
    // Remove from scene but keep in pool
    if (obj.parent) obj.parent.remove(obj);
    
    this.active.delete(obj);
    this.pool.push(obj);  // KEMBALIKAN ke pool!
  }
  
  releaseAll(): void {
    // Release all active objects back to pool
    for (const obj of this.active) {
      this.release(obj);
    }
  }
  
  dispose(): void {
    // ONLY call on app unmount — destroys all GPU resources
    for (const obj of [...this.active, ...this.pool]) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
    }
    this.pool = [];
    this.active.clear();
  }
}

// Usage in SeismicLayer:
const meshPool = new ObjectPool(() => {
  const geo = new THREE.SphereGeometry(1, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  return new THREE.Mesh(geo, mat);
});

// When updating data — release old, acquire new (NO dispose)
function updateSeismicPoints(newData: SeismicEvent[]) {
  meshPool.releaseAll();  // Hide old, return to pool
  
  newData.forEach(event => {
    const mesh = meshPool.acquire();  // Reuse from pool
    mesh.position.set(...latLngToVector3(event.lat, event.lng));
    mesh.scale.setScalar(magnitudeToScale(event.magnitude));
    globe.scene().add(mesh);
  });
}

// On app unmount — dispose everything
useEffect(() => {
  return () => {
    meshPool.dispose();  // Free all GPU memory
  };
}, []);

// Memory monitoring (development only)
function logWebGLMemory() {
  const info = (globe.renderer() as any).info;
  console.log('WebGL Memory:', {
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    programs: info.programs?.length || 0
  });
}

// Call periodically in development
setInterval(logWebGLMemory, 30000);
```

---

## Phase 3 Deliverables

1. ✅ Interactive 3D globe with all data layers
2. ✅ Real-time WebSocket updates on globe
3. ✅ Time scrubber with play/pause/speed controls
4. ✅ Event detail panels (click any event)
5. ✅ Anomaly feed sidebar
6. ✅ Tethys Speaks narrative display
7. ✅ Layer toggle and filter controls
8. ✅ Responsive design (mobile + desktop)
9. ✅ Deployed to Cloudflare Pages

## Phase 3 Success Criteria

- [ ] Globe renders at 30+ fps with 1000+ data points
- [ ] All 6 data layers togglable and functional
- [ ] Click any event → detail panel appears
- [ ] Time scrubber allows 7-day rewind
- [ ] WebSocket updates appear on globe within 1 second
- [ ] Responsive on mobile (320px+)
- [ ] Deployed and accessible via public URL
