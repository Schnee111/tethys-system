import { useGlobeStore } from '../stores/globeStore';

const THRESHOLDS = [0, 1, 2, 3, 4, 5];

export function MagnitudeFilter() {
  const { minMagnitude, setMinMagnitude } = useGlobeStore();

  return (
    <div style={{
      position: 'fixed',
      bottom: 48,
      left: 48,
      zIndex: 40,
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(16px)',
      borderRadius: 9999,
      padding: '6px 8px',
      userSelect: 'none',
    }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 8,
        color: '#52525b',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginRight: 4,
      }}>
        M
      </span>
      {THRESHOLDS.map((mag) => {
        const isActive = minMagnitude === mag;
        return (
          <button
            key={mag}
            onClick={() => setMinMagnitude(mag)}
            style={{
              background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
              border: 'none',
              borderRadius: 4,
              padding: '3px 6px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: isActive ? '#e4e4e7' : '#52525b',
              fontWeight: isActive ? 700 : 400,
              transition: 'all 0.15s',
            }}
          >
            {mag === 0 ? 'All' : `${mag}+`}
          </button>
        );
      })}
    </div>
  );
}
