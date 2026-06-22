import { useEffect, useState, useMemo } from 'react';
import { useGlassStyle } from '../utils/glass';
import { api } from '../api/client';

interface AtmosphericReading {
  time: string;
  location_name: string;
  latitude: number;
  longitude: number;
  category: string;
  temperature: number;
  temp_min: number | null;
  precipitation: number | null;
  wind_speed: number;
  wind_dir: number | null;
}

interface AtmosphericResponse {
  count: number;
  readings: AtmosphericReading[];
}

export function AtmosphericCard() {
  const glass = useGlassStyle();
  const [data, setData] = useState<AtmosphericResponse | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.getAtmospheric({ hours: 24 });
        if (res) setData(res);
      } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    if (!data || !data.readings.length) return null;
    const readings = data.readings;
    const avgTemp = readings.reduce((s, r) => s + (r.temperature ?? 0), 0) / readings.length;
    const avgWind = readings.reduce((s, r) => s + (r.wind_speed ?? 0), 0) / readings.length;
    const top3 = [...readings]
      .sort((a, b) => (b.temperature ?? 0) - (a.temperature ?? 0))
      .slice(0, 3);
    return { avgTemp, avgWind, top3 };
  }, [data]);

  return (
    <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          Atmosphere
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>Source: Open-Meteo</span>
      </div>

      {!data || !stats ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#52525b', textAlign: 'center', padding: '8px 0' }}>
          No data
        </span>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#60a5fa' }}>{data.count}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a', textTransform: 'uppercase' }}>Locations</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#e4e4e7' }}>{stats.avgTemp.toFixed(1)}°</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a', textTransform: 'uppercase' }}>Avg Temp</span>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#e4e4e7' }}>{stats.avgWind.toFixed(1)}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a', textTransform: 'uppercase' }}>Avg Wind</span>
            </div>
          </div>

          {/* Top 3 hottest locations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {stats.top3.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                  {r.location_name}
                </span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: '#60a5fa' }}>
                    {r.temperature?.toFixed(1)}°
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#71717a' }}>
                    {r.wind_speed?.toFixed(1)} m/s
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
