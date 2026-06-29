import { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useDataStore } from '../../stores/dataStore';
import { useGlobeStore } from '../../stores/globeStore';
import { DOMAIN_COLORS } from '../../utils/colors';

const TETHYS_BG = '#020508';

// ===================== Map Style =====================
const STYLE: any = {
  version: 8, name: 'Tethys',
  projection: { type: 'globe' },
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256, attribution: '© Esri', maxzoom: 19,
    },
  },
  layers: [
    // Deep ocean base — always visible behind tiles, prevents starfield bleed-through
    { id: 'ocean', type: 'background', paint: { 'background-color': '#0a1628' } },
    // Satellite imagery on top — loads progressively as tiles arrive
    { id: 'satellite', type: 'raster', source: 'satellite',
      paint: { 'raster-opacity': 1, 'raster-brightness-max': 0.75, 'raster-brightness-min': 0.05, 'raster-contrast': 0.05, 'raster-saturation': -0.1 },
    },
  ],
  sky: {
    'atmosphere-blend': [
      'interpolate', ['linear'], ['zoom'],
      0, 1,   // full atmosphere at low zoom
      4, 0.8, // still visible at mid zoom
      6, 0.3, // fade at close zoom
      8, 0    // gone when zoomed in
    ]
  },
  light: { anchor: 'viewport', position: [45, 80, 80] },
};

// ===================== Starfield Custom Layer =====================
// Technique from @geoql/maplibre-gl-starfield:
// - Use modelViewProjectionMatrix, strip translation → stars at infinity
// - Render as FIRST layer (behind globe)
// - depthWrite:false, depthTest:false → always draw, globe draws on top

const STAR_COUNT = 25000;
const STAR_RADIUS = 100;

const STAR_VERT = `#version 300 es
precision highp float;
in vec3 a_pos;
in vec4 a_color;
in float a_size;
uniform mat4 u_mvp;
uniform float u_dpr;
out vec4 v_color;
out float v_twinkle;
void main() {
  gl_Position = u_mvp * vec4(a_pos, 1.0);
  gl_PointSize = a_size * u_dpr;
  v_color = a_color;
  v_twinkle = a_pos.x * 3.7 + a_pos.y * 2.3 + a_pos.z * 5.1;
}`;

const STAR_FRAG = `#version 300 es
precision mediump float;
uniform float u_time;
in vec4 v_color;
in float v_twinkle;
out vec4 fragColor;
void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float d = length(pc);
  float core = smoothstep(0.45, 0.0, d);
  float glow = smoothstep(0.5, 0.0, d) * 0.5;
  float halo = smoothstep(1.0, 0.3, d) * 0.12;
  float alpha = core + glow + halo;
  float phase = v_twinkle * 6.2832;
  float tw = 0.7 + 0.3 * sin(u_time * (0.8 + fract(v_twinkle) * 2.0) + phase);
  fragColor = vec4(v_color.rgb * tw * alpha, v_color.a * alpha * tw);
}`;

function genStars(count: number) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 4);
  const siz = new Float32Array(count);

  // Seeded random for reproducible but natural-looking distribution
  let seed = 42;
  const rand = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };

  for (let i = 0; i < count; i++) {
    // Uniform sphere distribution (not Fibonacci — more random)
    const z = 2 * rand() - 1;
    const rho = Math.sqrt(1 - z * z);
    const angle = rand() * 2 * Math.PI;
    pos[i * 3] = STAR_RADIUS * rho * Math.cos(angle);
    pos[i * 3 + 1] = STAR_RADIUS * z;
    pos[i * 3 + 2] = STAR_RADIUS * rho * Math.sin(angle);

    // Magnitude distribution: most stars dim, few bright (like real sky)
    // Using inverse transform sampling for realistic magnitude distribution
    const mag = rand();
    let brightness, size;

    if (mag < 0.40) {
      // 40% — dim stars (background texture)
      brightness = 0.25 + rand() * 0.2;
      size = 0.6 + rand() * 0.8;
    } else if (mag < 0.70) {
      // 30% — medium dim stars
      brightness = 0.35 + rand() * 0.2;
      size = 1.0 + rand() * 1.0;
    } else if (mag < 0.88) {
      // 18% — medium stars
      brightness = 0.5 + rand() * 0.2;
      size = 1.5 + rand() * 1.5;
    } else if (mag < 0.96) {
      // 8% — bright stars
      brightness = 0.65 + rand() * 0.15;
      size = 2.5 + rand() * 2.0;
    } else {
      // 4% — very bright stars (Sirius-class)
      brightness = 0.75 + rand() * 0.15;
      size = 4.0 + rand() * 3.0;
    }

    // Star color temperature (spectral class simulation)
    const temp = rand();
    let r, g, b;
    if (temp < 0.03) {
      // O/B stars — blue-white
      r = 0.7 + rand() * 0.1; g = 0.78 + rand() * 0.1; b = 1.0;
    } else if (temp < 0.10) {
      // A stars — white with slight blue
      r = 0.85 + rand() * 0.1; g = 0.88 + rand() * 0.08; b = 1.0;
    } else if (temp < 0.25) {
      // F stars — white
      r = 0.95 + rand() * 0.05; g = 0.95 + rand() * 0.05; b = 0.95 + rand() * 0.05;
    } else if (temp < 0.55) {
      // G stars — yellow-white (like Sun)
      r = 1.0; g = 0.95 + rand() * 0.05; b = 0.85 + rand() * 0.1;
    } else if (temp < 0.80) {
      // K stars — orange
      r = 1.0; g = 0.85 + rand() * 0.1; b = 0.7 + rand() * 0.1;
    } else {
      // M stars — red-orange
      r = 1.0; g = 0.7 + rand() * 0.15; b = 0.6 + rand() * 0.1;
    }

    col[i * 4] = r * brightness;
    col[i * 4 + 1] = g * brightness;
    col[i * 4 + 2] = b * brightness;
    col[i * 4 + 3] = 0.4 + brightness * 0.6;
    siz[i] = size;
  }
  return { pos, col, siz };
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('[Starfield] Shader error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function linkProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram | null {
  const vsS = compileShader(gl, gl.VERTEX_SHADER, vs);
  const fsS = compileShader(gl, gl.FRAGMENT_SHADER, fs);
  if (!vsS || !fsS) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, vsS);
  gl.attachShader(p, fsS);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('[Starfield] Program error:', gl.getProgramInfoLog(p));
    return null;
  }
  gl.deleteShader(vsS);
  gl.deleteShader(fsS);
  return p;
}

function createStarfieldLayer(): any {
  let program: WebGLProgram | null = null;
  let posBuf: WebGLBuffer | null = null;
  let colBuf: WebGLBuffer | null = null;
  let sizBuf: WebGLBuffer | null = null;
  let timeLoc: WebGLUniformLocation | null = null;
  let mvpLoc: WebGLUniformLocation | null = null;
  let dprLoc: WebGLUniformLocation | null = null;
  let debugOnce = true;

  return {
    id: 'starfield',
    type: 'custom' as const,
    renderingMode: '3d' as const,

    onAdd(_map: maplibregl.Map, gl: WebGLRenderingContext) {
      const gl2 = gl as unknown as WebGL2RenderingContext;

      program = linkProgram(gl2, STAR_VERT, STAR_FRAG);
      if (!program) return;

      const stars = genStars(STAR_COUNT);

      posBuf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferData(gl.ARRAY_BUFFER, stars.pos, gl.STATIC_DRAW);

      colBuf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
      gl.bufferData(gl.ARRAY_BUFFER, stars.col, gl.STATIC_DRAW);

      sizBuf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, sizBuf);
      gl.bufferData(gl.ARRAY_BUFFER, stars.siz, gl.STATIC_DRAW);

      timeLoc = gl.getUniformLocation(program, 'u_time');
      mvpLoc = gl.getUniformLocation(program, 'u_mvp');
      dprLoc = gl.getUniformLocation(program, 'u_dpr');

      console.log('[Starfield] Layer initialized', STAR_COUNT, 'stars');
    },

    render(gl: WebGLRenderingContext, args: any) {
      if (!program) return;

      const dpr = window.devicePixelRatio || 1;
      const time = performance.now() / 1000;

      // KEY TECHNIQUE: use modelViewProjectionMatrix, strip translation
      // This makes stars stay at infinity regardless of camera position/zoom
      const mvp = new Float32Array(args.modelViewProjectionMatrix);
      mvp[12] = 0; // strip translation X
      mvp[13] = 0; // strip translation Y
      mvp[14] = 0; // strip translation Z

      // No depth test — stars always draw, globe renders on top via layer order
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

      gl.useProgram(program);
      gl.uniformMatrix4fv(mvpLoc, false, mvp);
      gl.uniform1f(dprLoc, dpr);
      gl.uniform1f(timeLoc, time);

      const aPos = gl.getAttribLocation(program, 'a_pos');
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

      const aCol = gl.getAttribLocation(program, 'a_color');
      gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
      gl.enableVertexAttribArray(aCol);
      gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 0, 0);

      const aSiz = gl.getAttribLocation(program, 'a_size');
      gl.bindBuffer(gl.ARRAY_BUFFER, sizBuf);
      gl.enableVertexAttribArray(aSiz);
      gl.vertexAttribPointer(aSiz, 1, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, STAR_COUNT);

      gl.disableVertexAttribArray(aPos);
      gl.disableVertexAttribArray(aCol);
      gl.disableVertexAttribArray(aSiz);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);

      if (debugOnce) {
        debugOnce = false;
        console.log('[Starfield] Rendered', {
          error: gl.getError(),
          hasMVP: !!args.modelViewProjectionMatrix,
        });
      }

      (gl as any).canvas?.maplibregl_triggerRepaint?.();
    },
  };
}

// ===================== GeoJSON =====================
function toGeoJSON(events: any[]) {
  return { type: 'FeatureCollection' as const, features: events.map(e => ({
    type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [e.longitude, e.latitude] },
    properties: { event_id: e.event_id, domain: e.domain, magnitude: e.magnitude||0, location: e.location||'', depth_km: e.depth_km||0, time: e.time, description: e.description||'' },
  }))};
}
function selGeoJSON(ev: any|null) {
  if (!ev) return { type: 'FeatureCollection' as const, features: [] };
  return { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [ev.longitude, ev.latitude] }, properties: { domain: ev.domain, magnitude: ev.magnitude||0 } }] };
}

// ===================== Layer Defs =====================
const dc = ['match',['get','domain'],'seismic','#ef4444','volcanic','#f97316','solar_wind','#eab308','goes','#f59e0b','atmospheric','#3b82f6','space_weather','#8b5cf6','#6b7280'];
const LAYERS: Record<string, any> = {
  halo:     { id:'event-halo', type:'circle', source:'events', filter:['!',['has','point_count']], paint:{'circle-color':dc,'circle-radius':['interpolate',['linear'],['get','magnitude'],0,8,3,12,5,18,7,28],'circle-opacity':0.15}},
  cluster:  { id:'clusters', type:'circle', source:'events', filter:['has','point_count'], paint:{'circle-color':['step',['get','point_count'],'#f59e0b',10,'#ef4444',50,'#dc2626'],'circle-radius':['step',['get','point_count'],12,10,18,50,25],'circle-opacity':0.8,'circle-stroke-width':1,'circle-stroke-color':'#fff','circle-stroke-opacity':0.3}},
  count:    { id:'cluster-count', type:'symbol', source:'events', filter:['has','point_count'], layout:{'text-field':'{point_count_abbreviated}','text-size':11,'text-allow-overlap':true}, paint:{'text-color':'#fff'}},
  point:    { id:'unclustered-point', type:'circle', source:'events', filter:['!',['has','point_count']], paint:{'circle-color':dc,'circle-radius':['interpolate',['linear'],['get','magnitude'],0,4,3,6,5,10,7,16],'circle-opacity':0.85,'circle-stroke-width':1.5,'circle-stroke-color':'#fff','circle-stroke-opacity':0.4}},
  selected: { id:'selected-point', type:'circle', source:'selected', paint:{'circle-color':dc,'circle-radius':['interpolate',['linear'],['get','magnitude'],0,6,3,9,5,14,7,22],'circle-opacity':1,'circle-stroke-width':2.5,'circle-stroke-color':'#fff','circle-stroke-opacity':0.9}},
  pulse:    { id:'selected-pulse', type:'circle', source:'selected', paint:{'circle-color':'#ef4444','circle-radius':20,'circle-opacity':0.3,'circle-stroke-width':2,'circle-stroke-color':'#fff','circle-stroke-opacity':0.5}},
};

// ===================== Component =====================
export function TethysGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map|null>(null);
  const { events } = useDataStore();
  const { activeCategories, minMagnitude, maxMagnitude, selectedEvent, setSelectedEvent, setAltitude } = useGlobeStore();
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const layersAdded = useRef(false);
  const flyingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current, style: STYLE, center: [0,20], zoom: 2.5, pitch: 0, maxPitch: 85,
      renderWorldCopies: false, attributionControl: false,
      canvasContextAttributes: { alpha: true, premultipliedAlpha: false },
      // Prefetch tiles beyond viewport — prevents pop-in during auto-rotate
      maxTileCacheSize: 500,
      maxTileCacheZoomLevels: 8,
      fadeDuration: 0,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: false }), 'bottom-right');

    function addLayers() {
      if (layersAdded.current) return;
      layersAdded.current = true;

      // Add starfield as FIRST layer — behind everything
      try {
        const firstLayer = map.getStyle().layers?.[0]?.id;
        map.addLayer(createStarfieldLayer(), firstLayer);
      } catch (e) { console.warn('[Starfield] addLayer failed:', e); }

      map.addSource('events', { type:'geojson', data:{ type:'FeatureCollection', features:[] }, cluster:true, clusterMaxZoom:8, clusterRadius:50, maxzoom:10 });
      map.addSource('selected', { type:'geojson', data:{ type:'FeatureCollection', features:[] } });
      for (const k of ['halo','cluster','count','point','pulse','selected']) {
        try { map.addLayer(LAYERS[k]); } catch(_) {}
      }

      const c = map.getContainer().querySelector('.maplibregl-ctrl-attrib') as HTMLElement;
      if (c) c.style.display = 'none';
    }

    map.on('load', () => { addLayers(); });
    setTimeout(() => { addLayers(); }, 1500);

    // Dynamic pitch tilt — 3D perspective when zoomed close to ground
    // Cubic ease-in: very gentle at start, picks up as zoom approaches ground.
    // Starts at zoom 4 (continental → country scale), maxes at zoom 10.
    const getTargetPitch = (zoom: number): number => {
      if (zoom <= 4) return 0;
      if (zoom >= 10) return 35;
      const t = (zoom - 4) / 6;
      return t * t * t * 35; // cubic ease-in — gentle start
    };

    map.on('click', 'clusters', async (e:any) => {
      const f = e.features?.[0]; if (!f) return;
      const src = map.getSource('events') as maplibregl.GeoJSONSource;
      const z = await src.getClusterExpansionZoom(f.properties.cluster_id);
      flyingRef.current = true;
      map.flyTo({ center: f.geometry.coordinates, zoom: z, pitch: getTargetPitch(z), duration: 1500 });
      map.once('moveend', () => { flyingRef.current = false; });
    });
    map.on('click', 'unclustered-point', (e:any) => {
      const f = e.features?.[0]; if (!f) return;
      const ev = events.find(v => v.event_id === f.properties.event_id);
      if (ev) setSelectedEvent(selectedEvent?.event_id === ev.event_id ? null : ev);
    });
    map.on('mousemove', 'unclustered-point', (e:any) => {
      const f = e.features?.[0];
      if (f) { map.getCanvas().style.cursor = 'pointer'; setHoverInfo({ lng: e.lngLat.lng, lat: e.lngLat.lat, p: f.properties }); }
    });
    map.on('mouseleave', 'unclustered-point', () => { map.getCanvas().style.cursor = ''; setHoverInfo(null); });

    let last = 0;
    map.on('move', () => {
      const n = Date.now();
      if (n - last < 500) return;
      last = n;
      setAltitude(Math.pow(2, 15 - map.getZoom()) * 100 / 6371000);
    });

    // Auto-rotate globe — shift longitude to simulate Earth's rotation on its axis
    let autoRotating = true;
    let userInteracting = false;
    let programmaticMove = false;
    let lastFrame = performance.now();
    const ROTATION_SPEED = 0.015;
    const ZOOM_PAUSE_THRESHOLD = 4;

    map.jumpTo({ bearing: 0 });

    // Track programmatic moveend — reset flag INSIDE handler (moveend is async)
    map.on('moveend', () => {
      if (programmaticMove) {
        programmaticMove = false;
        return; // don't touch userInteracting for programmatic moves
      }
      // This was a user-initiated moveend
      userInteracting = false;
    });

    // User interaction tracking — smart click-vs-drag detection
    // PROBLEM: mouseup fired → userInteracting=false → next frame autoRotate
    // called jumpTo() → stop() killed drag momentum. Now we wait for moveend.
    let zoomTimeout: ReturnType<typeof setTimeout>;
    let interactionEndTimeout: ReturnType<typeof setTimeout>;
    let dragStartPoint: { x: number; y: number } | null = null;
    let isZooming = false;

    function startInteraction() {
      userInteracting = true;
      clearTimeout(zoomTimeout);
      clearTimeout(interactionEndTimeout);
    }

    map.on('mousedown', (e: any) => {
      startInteraction();
      isZooming = false;
      dragStartPoint = { x: e.point.x, y: e.point.y };
    });
    map.on('touchstart', () => {
      startInteraction();
      isZooming = false;
    });

    // mouseup: only clear if it was a click (distance < 3px), not a drag
    map.on('mouseup', (e: any) => {
      if (programmaticMove) return;
      if (dragStartPoint) {
        const dx = e.point.x - dragStartPoint.x;
        const dy = e.point.y - dragStartPoint.y;
        if (Math.sqrt(dx * dx + dy * dy) < 3) {
          userInteracting = false; // was a click, not a drag
        }
        // else: was a drag — moveend will clear userInteracting
      }
      dragStartPoint = null;
    });
    // touchend: timeout fallback (500ms covers MapLibre touch inertia)
    map.on('touchend', () => {
      if (programmaticMove) return;
      clearTimeout(interactionEndTimeout);
      interactionEndTimeout = setTimeout(() => { userInteracting = false; }, 500);
    });

    map.on('wheel', () => {
      startInteraction();
      isZooming = true;
      zoomTimeout = setTimeout(() => { isZooming = false; userInteracting = false; }, 300);
    });
    map.on('zoom', () => {
      startInteraction();
      isZooming = true;
      zoomTimeout = setTimeout(() => { isZooming = false; userInteracting = false; }, 300);
    });

    const autoRotate = () => {
      if (!map.isStyleLoaded()) { requestAnimationFrame(autoRotate); return; }

      const now = performance.now();
      const dt = (now - lastFrame) / 16.67;
      lastFrame = now;

      const zoom = map.getZoom();
      const hasSelection = !!useGlobeStore.getState().selectedEvent;

      autoRotating = !(zoom > ZOOM_PAUSE_THRESHOLD || hasSelection || userInteracting || flyingRef.current);

      if (autoRotating) {
        // Bypass jumpTo → stop() to avoid killing any active drag inertia.
        // jumpTo() calls this.stop() as first line (MapLibre line 69320) which
        // resets ALL handlers including ScrollZoomHandler and kills drag momentum.
        // Direct transform mutation — same pattern as pitch fix below.
        const center = map.getCenter();
        const t = (map as any).transform;
        t.setCenter(new maplibregl.LngLat(center.lng + ROTATION_SPEED * dt, center.lat));
        t.setBearing(0);
        map.triggerRepaint();
      }

      // Pitch tilt — lerp each frame for smooth interpolation
      // IMPORTANT: must NOT call jumpTo/easeTo/setPitch — they all call stop() which
      // resets ScrollZoomHandler and kills scroll-zoom animation (MapLibre source line 69320).
      // Instead, set transform.pitch directly (same as jumpTo internally does).
      if (!flyingRef.current && (!userInteracting || isZooming)) {
        const targetPitch = getTargetPitch(zoom);
        const currentPitch = map.getPitch();
        if (Math.abs(targetPitch - currentPitch) > 0.5) {
          const newPitch = currentPitch + (targetPitch - currentPitch) * 0.08;
          (map as any).transform.setPitch(newPitch);
          map.triggerRepaint();
        }
      }

      requestAnimationFrame(autoRotate);
    };
    requestAnimationFrame(autoRotate);

    mapRef.current = map;
    return () => {
      clearTimeout(zoomTimeout);
      clearTimeout(interactionEndTimeout);
      map.remove(); mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current; if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('events') as maplibregl.GeoJSONSource; if (!src) return;
    const cutoff = Date.now() - 24*60*60*1000;
    src.setData(toGeoJSON(events.filter(e => {
      if (!activeCategories.has(e.domain)) return false;
      if (e.magnitude != null && (e.magnitude < minMagnitude || e.magnitude > maxMagnitude)) return false;
      return new Date(e.time).getTime() >= cutoff;
    })));
  }, [events, activeCategories, minMagnitude, maxMagnitude]);

  useEffect(() => {
    const map = mapRef.current; if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('selected') as maplibregl.GeoJSONSource; if (!src) return;
    src.setData(selGeoJSON(selectedEvent));
    if (selectedEvent) {
      flyingRef.current = true;
      map.flyTo({
        center:[selectedEvent.longitude, selectedEvent.latitude],
        zoom:6, pitch: 35, duration:2000,
      });
      map.once('moveend', () => { flyingRef.current = false; });
    } else {
      // Return to default view when deselecting
      flyingRef.current = true;
      map.flyTo({ center:[0, 20], zoom: 2.5, bearing: 0, pitch: 0, duration: 2000 });
      map.once('moveend', () => { flyingRef.current = false; });
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (!selectedEvent) return;
    let frame: number;
    const go = () => {
      const t = (Date.now() % 2000) / 2000;
      const r = 10 + (selectedEvent.magnitude||1)*3 + t*25;
      const o = 0.35 * (1-t);
      const map = mapRef.current;
      if (map?.isStyleLoaded() && map.getLayer('selected-pulse')) {
        try { map.setPaintProperty('selected-pulse','circle-radius',r); map.setPaintProperty('selected-pulse','circle-opacity',o); } catch(_) {}
      }
      frame = requestAnimationFrame(go);
    };
    frame = requestAnimationFrame(go);
    return () => cancelAnimationFrame(frame);
  }, [selectedEvent]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: TETHYS_BG }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
      {hoverInfo && (
        <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none', background:'rgba(10,22,40,0.92)', border:'1px solid rgba(245,166,35,0.25)', borderRadius:6, padding:'8px 12px', color:'#e0e6ed', fontFamily:'var(--font-mono)', fontSize:10, backdropFilter:'blur(8px)', zIndex:10 }}>
          <div style={{ color:DOMAIN_COLORS[hoverInfo.p.domain]||'#6b7280', fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{hoverInfo.p.domain}</div>
          {hoverInfo.p.magnitude>0 && <div style={{ color:'#f59e0b' }}>M{Number(hoverInfo.p.magnitude).toFixed(1)}</div>}
          <div>{hoverInfo.p.location}</div>
          {hoverInfo.p.depth_km>0 && <div>Depth: {Number(hoverInfo.p.depth_km).toFixed(1)} km</div>}
          <div style={{ color:'#71717a', marginTop:4 }}>{new Date(hoverInfo.p.time).toLocaleString()}</div>
        </div>
      )}
    </div>
  );
}
