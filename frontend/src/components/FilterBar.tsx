import { Activity, Zap, Wind } from 'lucide-react';
import { useGlobeStore } from '../stores/globeStore';

const DOMAINS = [
  { key: 'seismic', label: 'Seismic', icon: Activity, color: '#f87171' },
  { key: 'solar', label: 'Solar', icon: Zap, color: '#fbbf24' },
  { key: 'atmospheric', label: 'Atmospheric', icon: Wind, color: '#60a5fa' },
];

export function FilterBar() {
  const {
    activeCategories, toggleCategory,
    minMagnitude, maxMagnitude,
    setMinMagnitude, setMaxMagnitude,
  } = useGlobeStore();

  const handleMag = (which: 'min' | 'max', val: number) => {
    if (which === 'min') setMinMagnitude(Math.min(val, maxMagnitude));
    else setMaxMagnitude(Math.max(val, minMagnitude));
  };

  const rangePercent = (v: number) => (v / 8) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                color: active ? d.color : '#3f3f46',
                transition: 'color 0.15s',
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                letterSpacing: '0.12em',
                color: active ? '#d4d4d8' : '#3f3f46',
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

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a', minWidth: 14, textAlign: 'right' }}>
          {minMagnitude}
        </span>

        {/* Slider */}
        <div style={{ flex: 1, position: 'relative', height: 16, display: 'flex', alignItems: 'center' }}>
          {/* Track */}
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.08)' }} />
          {/* Fill */}
          <div style={{
            position: 'absolute',
            left: `${rangePercent(minMagnitude)}%`,
            width: `${rangePercent(maxMagnitude) - rangePercent(minMagnitude)}%`,
            height: 2, borderRadius: 1,
            background: 'rgba(255,255,255,0.3)',
          }} />
          {/* Min input */}
          <input type="range" min={0} max={8} step={0.5} value={minMagnitude}
            onChange={(e) => handleMag('min', Number(e.target.value))}
            style={{ position: 'absolute', width: '100%', height: 16, background: 'transparent', appearance: 'none', WebkitAppearance: 'none', pointerEvents: 'none', zIndex: 2, margin: 0 }}
          />
          {/* Max input */}
          <input type="range" min={0} max={8} step={0.5} value={maxMagnitude}
            onChange={(e) => handleMag('max', Number(e.target.value))}
            style={{ position: 'absolute', width: '100%', height: 16, background: 'transparent', appearance: 'none', WebkitAppearance: 'none', pointerEvents: 'none', zIndex: 3, margin: 0 }}
          />
        </div>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a', minWidth: 14 }}>
          {maxMagnitude}
        </span>
      </div>
    </div>
  );
}
