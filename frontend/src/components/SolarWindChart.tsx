import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useGlassStyle } from '../utils/glass';
import axios from 'axios';

export function SolarWindChart() {
  const glass = useGlassStyle();
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    // Fetch recent solar wind data from the DB via a custom endpoint
    // For now, use the latest reading and generate mock trend
    // TODO: add /api/v1/solar-wind/history endpoint
    axios.get('/api/v1/solar-wind/latest').then((res) => {
      if (res.data) {
        // Generate 24h trend from single reading (placeholder)
        const now = Date.now();
        const points = [];
        for (let i = 23; i >= 0; i--) {
          const t = new Date(now - i * 3600000);
          points.push({
            time: t.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
            speed: res.data.speed ? res.data.speed + (Math.random() - 0.5) * 50 : null,
            density: res.data.density ? res.data.density + (Math.random() - 0.5) * 2 : null,
          });
        }
        setData(points);
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
              interval={5}
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
              yAxisId={0}
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
