import { useRef, useCallback, useState } from 'react';
import { Activity, Flame, SlidersHorizontal } from 'lucide-react';
import { useGlobeStore } from '../stores/globeStore';

const DOMAINS = [
  { key: 'seismic', label: 'Seismic', icon: Activity, color: '#f87171' },
  { key: 'volcanic', label: 'Volcanic', icon: Flame, color: '#fb923c' },
];

const MAG_MIN = 0;
const MAG_MAX = 8;
const MIN_GAP = 1.0; // Minimum distance between thumbs
const THUMB_SIZE = 10;

function DualRangeSlider({ min, max, onMinChange, onMaxChange }: {
  min: number; max: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null);

  const getValueFromX = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    // Snap to 0.5 increments
    return Math.round((pct * MAG_MAX) * 2) / 2;
  }, []);

  const handlePointerDown = useCallback((thumb: 'min' | 'max', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(thumb);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const val = getValueFromX(e.clientX);
    if (dragging === 'min') onMinChange(Math.min(val, max - MIN_GAP));
    else onMaxChange(Math.max(val, min + MIN_GAP));
  }, [dragging, getValueFromX, min, max, onMinChange, onMaxChange]);

  const handlePointerUp = useCallback(() => setDragging(null), []);

  const toPercent = (v: number) => ((v - MAG_MIN) / (MAG_MAX - MAG_MIN)) * 100;

  // Click on track to move nearest thumb
  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    const val = getValueFromX(e.clientX);
    const distToMin = Math.abs(val - min);
    const distToMax = Math.abs(val - max);
    if (distToMin <= distToMax) onMinChange(Math.min(val, max - MIN_GAP));
    else onMaxChange(Math.max(val, min + MIN_GAP));
  }, [getValueFromX, min, max, onMinChange, onMaxChange]);

  return (
    <div style={{ flex: 1, position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Track bg */}
      <div style={{ position: 'absolute', left: 0, right: 0, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.08)' }} />
      {/* Active fill */}
      <div style={{
        position: 'absolute',
        left: `${toPercent(min)}%`,
        width: `${toPercent(max) - toPercent(min)}%`,
        height: 2, borderRadius: 1,
        background: 'rgba(255,255,255,0.3)',
      }} />
      {/* Clickable track area */}
      <div ref={trackRef} onClick={handleTrackClick}
        style={{ position: 'absolute', left: 0, right: 0, height: 20, cursor: 'pointer' }} />
      {/* Min thumb */}
      <div
        onPointerDown={(e) => handlePointerDown('min', e)}
        style={{
          position: 'absolute',
          left: `${toPercent(min)}%`,
          width: THUMB_SIZE, height: THUMB_SIZE,
          borderRadius: '50%',
          background: '#fff',
          transform: 'translate(-50%, 0)',
          boxShadow: '0 0 4px rgba(255,255,255,0.25)',
          cursor: 'grab',
          touchAction: 'none',
          zIndex: dragging === 'min' ? 4 : 3,
        }}
      />
      {/* Max thumb */}
      <div
        onPointerDown={(e) => handlePointerDown('max', e)}
        style={{
          position: 'absolute',
          left: `${toPercent(max)}%`,
          width: THUMB_SIZE, height: THUMB_SIZE,
          borderRadius: '50%',
          background: '#fff',
          transform: 'translate(-50%, 0)',
          boxShadow: '0 0 4px rgba(255,255,255,0.25)',
          cursor: 'grab',
          touchAction: 'none',
          zIndex: dragging === 'max' ? 4 : 3,
        }}
      />
    </div>
  );
}

export function FilterBar() {
  const {
    activeCategories, toggleCategory,
    minMagnitude, maxMagnitude,
    setMinMagnitude, setMaxMagnitude,
  } = useGlobeStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SlidersHorizontal style={{ width: 12, height: 12, color: '#71717a' }} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          color: '#71717a',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Filters
        </span>
      </div>

      {/* Domain tabs */}
      <div style={{ display: 'flex', gap: 0 }}>
        {DOMAINS.map((d) => {
          const active = activeCategories.has(d.key);
          const Icon = d.icon;
          return (
            <button
              key={d.key}
              onClick={() => toggleCategory(d.key)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 0',
                borderBottom: `2px solid ${active ? d.color : 'transparent'}`,
                transition: 'border-color 0.15s',
              }}
            >
              <Icon style={{
                width: 13, height: 13,
                color: active ? d.color : '#71717a',
                transition: 'color 0.15s',
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                letterSpacing: '0.12em',
                color: active ? '#e4e4e7' : '#a1a1aa',
                textTransform: 'uppercase',
                fontWeight: 600,
                transition: 'color 0.15s',
              }}>
                {d.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Magnitude range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 8,
          color: '#52525b',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          Mag
        </span>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#a1a1aa', minWidth: 14, textAlign: 'right' }}>
          {minMagnitude}
        </span>

        <DualRangeSlider
          min={minMagnitude}
          max={maxMagnitude}
          onMinChange={setMinMagnitude}
          onMaxChange={setMaxMagnitude}
        />

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a', minWidth: 14 }}>
          {maxMagnitude}
        </span>
      </div>
    </div>
  );
}
