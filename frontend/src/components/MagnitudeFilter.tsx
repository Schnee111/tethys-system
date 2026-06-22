import { useGlobeStore } from '../stores/globeStore';

export function MagnitudeFilter() {
  const { minMagnitude, maxMagnitude, setMinMagnitude, setMaxMagnitude } = useGlobeStore();

  const handleChange = (which: 'min' | 'max', value: number) => {
    if (which === 'min') {
      setMinMagnitude(Math.min(value, maxMagnitude));
    } else {
      setMaxMagnitude(Math.max(value, minMagnitude));
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: '#52525b',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        minWidth: 20,
        textAlign: 'right',
      }}>
        M{minMagnitude}
      </span>

      <div style={{
        position: 'relative',
        width: 100,
        height: 20,
        display: 'flex',
        alignItems: 'center',
      }}>
        {/* Track background */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 2,
          borderRadius: 1,
          background: 'rgba(255,255,255,0.08)',
        }} />
        {/* Active range fill */}
        <div style={{
          position: 'absolute',
          left: `${(minMagnitude / 8) * 100}%`,
          right: `${100 - (maxMagnitude / 8) * 100}%`,
          height: 2,
          borderRadius: 1,
          background: 'rgba(255,255,255,0.3)',
        }} />
        {/* Min thumb */}
        <input
          type="range"
          min={0}
          max={8}
          step={0.5}
          value={minMagnitude}
          onChange={(e) => handleChange('min', Number(e.target.value))}
          style={{
            position: 'absolute',
            width: '100%',
            height: 20,
            background: 'transparent',
            appearance: 'none',
            WebkitAppearance: 'none',
            pointerEvents: 'none',
            zIndex: 2,
            margin: 0,
          }}
        />
        {/* Max thumb */}
        <input
          type="range"
          min={0}
          max={8}
          step={0.5}
          value={maxMagnitude}
          onChange={(e) => handleChange('max', Number(e.target.value))}
          style={{
            position: 'absolute',
            width: '100%',
            height: 20,
            background: 'transparent',
            appearance: 'none',
            WebkitAppearance: 'none',
            pointerEvents: 'none',
            zIndex: 3,
            margin: 0,
          }}
        />
      </div>

      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        color: '#52525b',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        minWidth: 20,
      }}>
        M{maxMagnitude}
      </span>
    </div>
  );
}
