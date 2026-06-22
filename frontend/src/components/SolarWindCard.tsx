import { useEffect, useState } from 'react';
import { useGlassStyle } from '../utils/glass';
import { api } from '../api/client';

interface SolarWindData {
  speed: number;
  density: number;
  temperature: number;
  bz_gsm: number;
  bt: number;
}

function GaugeBar({ value, max, color, label, unit, threshold }: {
  value: number | null; max: number; color: string; label: string; unit: string;
  threshold?: number;
}) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        {value != null ? (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e4e4e7', fontWeight: 700 }}>
            {value.toFixed(1)} <span style={{ fontSize: 8, color: '#71717a' }}>{unit}</span>
          </span>
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#3f3f46' }}>NO DATA</span>
        )}
      </div>
      <div style={{ position: 'relative', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        {value != null && (
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.5s ease' }} />
        )}
        {threshold != null && (
          <div style={{
            position: 'absolute', left: `${threshold}%`, top: -1, bottom: -1,
            width: 1, background: 'rgba(255,255,255,0.2)',
          }} />
        )}
      </div>
    </div>
  );
}

export function SolarWindCard() {
  const glass = useGlassStyle();
  const [data, setData] = useState<SolarWindData | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.getSolarWindLatest();
        if (res) setData(res);
      } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return null;

  const bzSouth = data.bz_gsm < 0;

  return (
    <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          Solar Wind
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>Source: DSCOVR</span>
      </div>

      {/* Speed: normal ~300-400, marker at 50% (400/800) */}
      <GaugeBar value={data.speed} max={800} color="#fbbf24" label="Speed" unit="km/s" threshold={50} />

      {/* Density: normal 1-10, marker at 50% (5/10) */}
      <GaugeBar value={data.density} max={10} color="#60a5fa" label="Density" unit="p/cm³" threshold={50} />

      {/* Bt: normal 5-10, marker at 33% (10/30) */}
      <GaugeBar value={data.bt} max={30} color="#a78bfa" label="Bt" unit="nT" threshold={33} />

      {/* Bz: most critical parameter */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a', textTransform: 'uppercase' }}>Bz</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            color: bzSouth ? '#ef4444' : '#4ade80',
          }}>
            {data.bz_gsm > 0 ? '+' : ''}{data.bz_gsm.toFixed(1)} nT {bzSouth ? '↓ South' : '↑ North'}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: bzSouth ? 'rgba(239,68,68,0.6)' : 'rgba(74,222,128,0.5)' }}>
          {bzSouth ? '⚠ South = geomagnetic storm risk' : '✓ North = stable conditions'}
        </span>
      </div>
    </div>
  );
}
