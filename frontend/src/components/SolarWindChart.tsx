import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useGlassStyle } from '../utils/glass';
import { api } from '../api/client';

export function SolarWindChart() {
  const glass = useGlassStyle();
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    api.getSolarWindHistory({ hours: 24 }).then((res) => {
      if (res?.readings?.length > 0) {
        const points = res.readings.map((r: any) => ({
          time: new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          speed: r.speed,
          density: r.density,
        }));
        // Downsample if too many points (max ~50 for chart readability)
        if (points.length > 50) {
          const step = Math.ceil(points.length / 50);
          setData(points.filter((_: any, i: number) => i % step === 0));
        } else {
          setData(points);
        }
      }
    }).catch(() => {});
  }, []);

  return (
    <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          Solar Wind Trend
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>24h</span>
      </div>
      <div style={{ height: 80 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 7, fill: '#3f3f46' }}
              axisLine={false}
              tickLine={false}
              interval={Math.max(0, Math.floor(data.length / 6))}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                color: '#e4e4e7',
              }}
              labelStyle={{ color: '#71717a' }}
            />
            <Line
              type="monotone"
              dataKey="speed"
              stroke="#fbbf24"
              strokeWidth={1.5}
              dot={false}
              name="Speed (km/s)"
            />
            <Line
              type="monotone"
              dataKey="density"
              stroke="#60a5fa"
              strokeWidth={1.5}
              dot={false}
              name="Density (p/cm³)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a' }}>
          <span style={{ width: 12, height: 2, background: '#fbbf24', borderRadius: 1, display: 'inline-block' }} />
          Speed
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a' }}>
          <span style={{ width: 12, height: 2, background: '#60a5fa', borderRadius: 1, display: 'inline-block' }} />
          Density
        </span>
      </div>
    </div>
  );
}
