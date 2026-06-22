import { useEffect, useState } from 'react';
import { useGlassStyle } from '../utils/glass';
import { api } from '../api/client';

interface GoesData {
  flux: number;
  satellite: string;
}

// NOAA X-ray flux classification
function fluxClass(flux: number): { label: string; color: string } {
  if (flux >= 1e-4) return { label: 'X', color: '#dc2626' };
  if (flux >= 1e-5) return { label: 'M', color: '#ef4444' };
  if (flux >= 1e-6) return { label: 'C', color: '#f59e0b' };
  if (flux >= 1e-7) return { label: 'B', color: '#eab308' };
  return { label: 'A', color: '#4ade80' };
}

export function GoesCard() {
  const glass = useGlassStyle();
  const [data, setData] = useState<GoesData | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.getGoesXray();
        if (res?.readings?.length > 0) {
          // Get latest xray flux (0.1-0.8nm band)
          const xray = res.readings.find((r: any) => r.energy_band === '0.1-0.8nm') || res.readings[0];
          setData({ flux: xray.flux, satellite: xray.satellite });
        }
      } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, []);

  const fc = data ? fluxClass(data.flux) : { label: '—', color: '#71717a' };
  const fluxStr = data ? data.flux.toExponential(1) : '—';

  return (
    <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          GOES X-ray
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a' }}>{data?.satellite || '—'}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Flux class badge */}
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${fc.color}18`,
          fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: fc.color,
        }}>
          {fc.label}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e4e4e7', fontWeight: 700 }}>
            {fluxStr} <span style={{ fontSize: 8, color: '#71717a' }}>W/m²</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a', marginTop: 2 }}>
            0.1-0.8nm band
          </div>
        </div>
      </div>

      {/* NOAA scale reference */}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {[
          { label: 'A', color: '#4ade80' },
          { label: 'B', color: '#eab308' },
          { label: 'C', color: '#f59e0b' },
          { label: 'M', color: '#ef4444' },
          { label: 'X', color: '#dc2626' },
        ].map((cls) => (
          <div key={cls.label} style={{
            flex: 1, textAlign: 'center', padding: '2px 0', borderRadius: 4,
            background: cls.label === fc.label ? `${cls.color}20` : 'transparent',
            fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: cls.label === fc.label ? 700 : 400,
            color: cls.label === fc.label ? cls.color : '#3f3f46',
          }}>
            {cls.label}
          </div>
        ))}
      </div>
    </div>
  );
}
