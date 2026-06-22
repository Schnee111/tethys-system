import { useEffect, useState } from 'react';
import { useGlassStyle } from '../../utils/glass';
import { api } from '../../api/client';

interface GoesData {
  flux: number;
  satellite: string;
}

function fluxClass(flux: number): { label: string; color: string; desc: string } {
  if (flux >= 1e-4) return { label: 'X', color: '#dc2626', desc: 'Extreme flare' };
  if (flux >= 1e-5) return { label: 'M', color: '#ef4444', desc: 'Strong flare' };
  if (flux >= 1e-6) return { label: 'C', color: '#f59e0b', desc: 'Moderate flare' };
  if (flux >= 1e-7) return { label: 'B', color: '#eab308', desc: 'Background' };
  return { label: 'A', color: '#4ade80', desc: 'Quiet' };
}

export function GoesCard() {
  const glass = useGlassStyle();
  const [data, setData] = useState<GoesData | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.getGoesXray({ hours: 6 });
        if (res?.readings?.length > 0) {
          const xray = res.readings.find((r: any) => r.energy_band === '0.1-0.8nm') || res.readings[0];
          setData({ flux: xray.flux, satellite: xray.satellite });
        }
      } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, []);

  const fc = data ? fluxClass(data.flux) : { label: '—', color: '#71717a', desc: 'No data' };
  const fluxStr = data ? data.flux.toExponential(1) : '—';

  return (
    <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          GOES X-ray
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>Source: GOES-16</span>
      </div>

      {/* Current value + description */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: fc.color, fontWeight: 700 }}>
          {fluxStr} <span style={{ fontSize: 9, color: '#71717a', fontWeight: 400 }}>W/m²</span>
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: fc.color }}>
          {fc.desc}
        </span>
      </div>

      {/* NOAA scale — active class highlighted */}
      <div style={{ display: 'flex', gap: 2 }}>
        {[
          { label: 'A', color: '#4ade80' },
          { label: 'B', color: '#eab308' },
          { label: 'C', color: '#f59e0b' },
          { label: 'M', color: '#ef4444' },
          { label: 'X', color: '#dc2626' },
        ].map((cls) => {
          const isActive = cls.label === fc.label;
          return (
            <div key={cls.label} style={{
              flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 4,
              background: isActive ? `${cls.color}25` : 'rgba(255,255,255,0.03)',
              transition: 'all 0.2s',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: isActive ? 700 : 400,
                color: isActive ? cls.color : '#3f3f46',
              }}>
                {cls.label}
              </div>
            </div>
          );
        })}
      </div>

      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b', textAlign: 'center' }}>
        0.1-0.8nm band · Each letter = 10× flux increase
      </span>
    </div>
  );
}
