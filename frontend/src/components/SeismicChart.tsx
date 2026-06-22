import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useGlassStyle } from '../utils/glass';
import { api } from '../api/client';

export function SeismicChart() {
  const glass = useGlassStyle();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    api.getSeismic({ hours: 24, limit: 1000 }).then((res) => {
      setEvents(res.events || []);
    }).catch(() => {});
  }, []);

  // Bucket events by hour
  const data = useMemo(() => {
    const now = Date.now();
    const buckets: { hour: string; count: number }[] = [];

    for (let i = 23; i >= 0; i--) {
      const t = new Date(now - i * 3600000);
      const label = t.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const start = now - (i + 1) * 3600000;
      const end = now - i * 3600000;
      const count = events.filter((e) => {
        const et = new Date(e.time).getTime();
        return et >= start && et < end;
      }).length;
      buckets.push({ hour: label, count });
    }
    return buckets;
  }, [events]);

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          Seismic Activity
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>24h</span>
      </div>
      <div style={{ height: 80 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 7, fill: '#3f3f46' }}
              axisLine={false}
              tickLine={false}
              interval={5}
            />
            <YAxis hide domain={[0, maxCount * 1.2]} />
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
              formatter={(value: any) => [`${value} events`, '']}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#f87171"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: '#f87171' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
