import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useGlassStyle } from '../utils/glass';
import { api } from '../api/client';

// NOAA X-ray class thresholds (W/m²)
const CLASSES = [
  { label: 'A', flux: 1e-8, color: '#4ade80' },
  { label: 'B', flux: 1e-7, color: '#eab308' },
  { label: 'C', flux: 1e-6, color: '#f59e0b' },
  { label: 'M', flux: 1e-5, color: '#ef4444' },
  { label: 'X', flux: 1e-4, color: '#dc2626' },
];

export function GoesChart() {
  const glass = useGlassStyle();
  const [rawData, setRawData] = useState<any[]>([]);

  useEffect(() => {
    api.getGoesXray({ hours: 24 }).then((res) => {
      if (res?.readings?.length > 0) {
        const filtered = res.readings
          .filter((r: any) => r.energy_band === '0.1-0.8nm')
          .map((r: any) => ({
            time: new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            flux: r.flux,
          }))
          .reverse(); // API returns DESC, chart needs ASC (oldest → newest)

        if (filtered.length > 50) {
          const step = Math.ceil(filtered.length / 50);
          setRawData(filtered.filter((_: any, i: number) => i % step === 0));
        } else {
          setRawData(filtered);
        }
      }
    }).catch(() => {});
  }, []);

  const currentFlux = rawData.length > 0 ? rawData[rawData.length - 1].flux : 0;
  const currentClass = CLASSES.reduce((acc, c) => currentFlux >= c.flux ? c : acc, CLASSES[0]);

  return (
    <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          GOES X-ray
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: currentClass.color, fontWeight: 700 }}>
            {currentClass.label}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>24h</span>
        </div>
      </div>
      <div style={{ height: 64 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rawData} margin={{ top: 4, right: 4, bottom: 2, left: 0 }}>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 7, fill: '#3f3f46' }}
              axisLine={false}
              tickLine={false}
              interval={Math.max(0, Math.floor(rawData.length / 4))}
            />
            <YAxis hide scale="log" domain={[1e-8, 1e-4]} />
            <Tooltip
              contentStyle={{
                background: 'rgba(0,0,0,0.85)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: '#e4e4e7',
              }}
              labelStyle={{ color: '#71717a' }}
              formatter={(value: any) => {
                if (value == null) return ['—', 'Flux'];
                const flux = Number(value);
                const cls = CLASSES.reduce((acc, c) => flux >= c.flux ? c : acc, CLASSES[0]);
                return [`${cls.label} ${flux.toExponential(1)} W/m²`, 'X-ray'];
              }}
            />
            {/* Class threshold lines */}
            {CLASSES.slice(1).map((c) => (
              <ReferenceLine
                key={c.label}
                y={c.flux}
                stroke={c.color}
                strokeDasharray="3 3"
                strokeOpacity={0.15}
              />
            ))}
            <Line
              type="monotone"
              dataKey="flux"
              stroke="#f59e0b"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Class labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 7 }}>
        {CLASSES.map((c) => (
          <span key={c.label} style={{ color: currentFlux >= c.flux ? c.color : '#3f3f46', fontWeight: currentFlux >= c.flux ? 700 : 400 }}>
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
