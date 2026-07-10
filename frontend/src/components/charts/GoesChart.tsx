import { useMemo } from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useGlassStyle } from '../../utils/glass';
import { useDataStore } from '../../stores/dataStore';

const CLASSES = [
  { label: 'A', flux: 1e-8, color: '#4ade80' },
  { label: 'B', flux: 1e-7, color: '#eab308' },
  { label: 'C', flux: 1e-6, color: '#f59e0b' },
  { label: 'M', flux: 1e-5, color: '#ef4444' },
  { label: 'X', flux: 1e-4, color: '#dc2626' },
];

export function GoesChart() {
  const glass = useGlassStyle();
  const rawData = useDataStore(s => s.rawGoes);
  const isLoading = useDataStore(s => s.isLoading);

  // Filter to xray 0.1-0.8nm band and downsample
  const chartData = useMemo(() => {
    const filtered = rawData
      .filter(r => r.energy_band === '0.1-0.8nm')
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      .map(r => ({
        time: new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        flux: r.flux,
        logFlux: Math.log10(r.flux),
      }));

    // Downsample if too many points
    if (filtered.length > 50) {
      const step = Math.ceil(filtered.length / 50);
      return filtered.filter((_, i) => i % step === 0);
    }
    return filtered;
  }, [rawData]);

  const currentFlux = chartData.length > 0
    ? chartData[chartData.length - 1]?.flux ?? 0
    : 0;
  const currentClass = CLASSES.reduce((acc, c) => currentFlux >= c.flux ? c : acc, CLASSES[0]);

  if (isLoading) {
    return (
      <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
            GOES X-ray
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>Loading...</span>
        </div>
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 24, height: 24, border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #f59e0b', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    );
  }

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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>24h · live</span>
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
