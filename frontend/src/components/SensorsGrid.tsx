import { useDataStore } from '../stores/dataStore';
import { useGlassStyle } from '../utils/glass';

export function SensorsGrid() {
  const { status } = useDataStore();
  const glass = useGlassStyle();
  const collectors = status?.collectors || {};
  const sources = [
    { key: 'seismic', label: 'SEISMIC' },
    { key: 'solar_wind', label: 'SOLAR' },
    { key: 'goes_flux', label: 'GOES' },
    { key: 'donki', label: 'DONKI' },
    { key: 'atmospheric', label: 'ATMOS' },
    { key: 'volcanic', label: 'VOLC' },
  ];

  const activeCount = Object.values(collectors).filter((c: any) => c.status === 'ok').length;

  return (
    <div style={{
      padding: '8px 10px',
      borderRadius: '10px',
      ...glass,
      textAlign: 'left',
      fontSize: 9,
      color: '#71717a',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 8, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.5)', textTransform: 'uppercase', fontWeight: 600 }}>
          DATA SOURCES
        </span>
        <span style={{ color: 'rgba(52,211,153,0.8)', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 8 }}>
          {activeCount}/{sources.length} ACTIVE
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {sources.map((s) => {
          const c = collectors[s.key];
          const isOk = c?.status === 'ok';
          return (
            <div
              key={s.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: isOk ? '#22c55e' : '#ef4444',
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 7,
                color: 'rgba(161,161,170,0.7)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                lineHeight: 1,
              }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
