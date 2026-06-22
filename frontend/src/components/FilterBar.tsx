import { Activity, Zap, Wind } from 'lucide-react';
import { useGlobeStore } from '../stores/globeStore';

const DOMAIN_CATEGORIES = [
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

  const handleMagChange = (which: 'min' | 'max', value: number) => {
    if (which === 'min') setMinMagnitude(Math.min(value, maxMagnitude));
    else setMaxMagnitude(Math.max(value, minMagnitude));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      paddingBottom: 12,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Domain filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {DOMAIN_CATEGORIES.map((cat) => {
          const isActive = activeCategories.has(cat.key);
          const Icon = cat.icon;
          return (
            <button
              key={cat.key}
              onClick={() => toggleCategory(cat.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${isActive ? cat.color : 'transparent'}`,
                cursor: 'pointer',
                padding: '4px 8px',
                transition: 'all 0.15s',
              }}
            >
              <Icon style={{ width: 11, height: 11, color: isActive ? cat.color : '#3f3f46' }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                letterSpacing: '0.1em',
                color: isActive ? '#d4d4d8' : '#3f3f46',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}>
                {cat.label}
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
          color: '#3f3f46',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          minWidth: 16,
        }}>
          MAG
        </span>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#52525b', minWidth: 20, textAlign: 'right' }}>
          {minMagnitude}
        </span>

        <div style={{ flex: 1, position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
          {/* Track bg */}
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, borderRadius: 1, background: 'rgba(255,255,255,0.06)' }} />
          {/* Active fill */}
          <div style={{
            position: 'absolute',
            left: `${(minMagnitude / 8) * 100}%`,
            right: `${100 - (maxMagnitude / 8) * 100}%`,
            height: 2, borderRadius: 1,
            background: 'rgba(255,255,255,0.25)',
          }} />
          {/* Min thumb */}
          <input type="range" min={0} max={8} step={0.5} value={minMagnitude}
            onChange={(e) => handleMagChange('min', Number(e.target.value))}
            style={{ position: 'absolute', width: '100%', height: 20, background: 'transparent', appearance: 'none', WebkitAppearance: 'none', pointerEvents: 'none', zIndex: 2, margin: 0 }}
          />
          {/* Max thumb */}
          <input type="range" min={0} max={8} step={0.5} value={maxMagnitude}
            onChange={(e) => handleMagChange('max', Number(e.target.value))}
            style={{ position: 'absolute', width: '100%', height: 20, background: 'transparent', appearance: 'none', WebkitAppearance: 'none', pointerEvents: 'none', zIndex: 3, margin: 0 }}
          />
        </div>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#52525b', minWidth: 20 }}>
          {maxMagnitude}
        </span>
      </div>
    </div>
  );
}
