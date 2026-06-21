import { useDataStore } from '../stores/dataStore';

export function SensorsGrid() {
  const { status } = useDataStore();
  const collectors = status?.collectors || {};
  const sources = [
    { key: 'seismic', label: 'SEISMIC' },
    { key: 'solar_wind', label: 'SOLAR WIND' },
    { key: 'goes_flux', label: 'GOES' },
    { key: 'donki', label: 'DONKI' },
    { key: 'atmospheric', label: 'ATMOSPHERIC' },
    { key: 'volcanic', label: 'VOLCANIC' },
  ];

  return (
    <div style={{
      padding: '14px',
      borderRadius: '16px',
      background: 'rgba(255,255,255,0.035)',
      backdropFilter: 'blur(64px)',
      textAlign: 'left',
      fontSize: 10,
      color: '#71717a',
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.5)', textTransform: 'uppercase', fontWeight: 600 }}>
          DATA SOURCES
        </span>
        <span style={{ color: 'rgba(52,211,153,0.8)', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 9 }}>
          {Object.values(collectors).filter((c: any) => c.status === 'ok').length}/{sources.length} ACTIVE
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {sources.map((s) => {
          const c = collectors[s.key];
          const isOk = c?.status === 'ok';
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: isOk ? '#22c55e' : '#ef4444' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(161,161,170,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
