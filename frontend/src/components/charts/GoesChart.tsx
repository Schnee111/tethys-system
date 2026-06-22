import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useGlassStyle } from '../../utils/glass';
import { api } from '../../api/client';

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
    const fetch = () => {
      api.getGoesXray({ hours: 24 }).then((res) => {
        if (res?.readings?.length > 0) {
          const filtered = res.readings
            .filter((r: any) => r.energy_band === '0.1-0.8nm')
            .map((r: any) => ({
              time: new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
              flux: r.flux,
            }))
            .reverse();
          setRawData(filtered.length > 50 ? filtered.filter((_: any, i: number) => i % Math.ceil(filtered.length / 50) === 0) : filtered);
        }
      }).catch(() => {});
    };
    fetch();
    const interval = setInterval(fetch, 60000);
    return () => clearInterval(interval);
  }, []);

  const currentFlux = rawData.length > 0 ? rawData[rawData.length - 1].flux : 0;
  const currentClass = CLASSES.reduce((acc, c) => currentFlux >= c.flux ? c : acc, CLASSES[0]);

  // Log transform for display (log10 of flux)
  const chartData = rawData.map(d => ({
    ...d,
    logFlux: Math.log10(d.flux),
  }));

  return (
    <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
      <div style={{ height: 56 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
            <XAxis dataKey="time" hide />
            {/* Log-scale reference lines for each class */}
            {CLASSES.map((c) => (
              <ReferenceLine
                key={c.label}
                y={Math.log10(c.flux)}
                stroke={c.color}
                strokeDasharray="3 3"
                strokeOpacity={0.12}
              />
            ))}
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
              formatter={(value: any, name: any, props: any) => {
                const flux = props.payload.flux;
                const cls = CLASSES.reduce((acc, c) => flux >= c.flux ? c : acc, CLASSES[0]);
                return [`${cls.label} ${flux.toExponential(1)} W/m²`, 'X-ray'];
              }}
            />
            <Line
              type="monotone"
              dataKey="logFlux"
              stroke="#f59e0b"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
