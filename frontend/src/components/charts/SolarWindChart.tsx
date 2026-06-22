import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useGlassStyle } from '../../utils/glass';
import { useDataStore } from '../../stores/dataStore';

function MiniChart({ data, dataKey, color, label, unit }: {
  data: any[]; dataKey: string; color: string; label: string; unit: string;
}) {
  const values = useMemo(() => data.map(d => d[dataKey]).filter(v => v != null), [data, dataKey]);
  const latest = values.length > 0 ? values[values.length - 1] : null;

  // Y-axis: data range with 10% padding (not from 0)
  const [yMin, yMax] = useMemo(() => {
    if (values.length === 0) return [0, 1];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.15 || 1;
    return [min - padding, max + padding];
  }, [values]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        {latest != null && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#e4e4e7', fontWeight: 700 }}>
            {latest.toFixed(1)} <span style={{ fontSize: 7, color: '#52525b' }}>{unit}</span>
          </span>
        )}
      </div>
      <div style={{ height: 32 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={[yMin, yMax]} />
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
              formatter={(value: any) => [Number(value).toFixed(1), label]}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SolarWindChart() {
  const glass = useGlassStyle();
  const rawSolarWind = useDataStore(s => s.rawSolarWind);

  // Merge plasma + mag records into chart-ready points
  const data = useMemo(() => {
    // Group by time (within 1 minute tolerance) and merge plasma + mag
    const plasmaRecords = rawSolarWind.filter(r => r.data_type === 'plasma');
    const points = plasmaRecords.map(r => ({
      time: new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      speed: r.speed ?? null,
      density: r.density ?? null,
    }));

    // Downsample if too many points
    if (points.length > 50) {
      const step = Math.ceil(points.length / 50);
      return points.filter((_, i) => i % step === 0);
    }
    return points;
  }, [rawSolarWind]);

  return (
    <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          Solar Wind
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>24h · live</span>
      </div>
      <MiniChart data={data} dataKey="speed" color="#fbbf24" label="Speed" unit="km/s" />
      <MiniChart data={data} dataKey="density" color="#60a5fa" label="Density" unit="p/cm³" />
    </div>
  );
}
