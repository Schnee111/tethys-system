import { useGlassStyle } from '../../utils/glass';
import type { Anomaly } from '../../types';

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#f43f5e',
  high: '#fb923c',
  medium: '#fbbf24',
  low: '#38bdf8',
};

const DOMAIN_LABEL: Record<string, string> = {
  seismic: 'SEISMIC',
  solar_wind: 'SOLAR WIND',
  goes: 'GOES FLUX',
  atmospheric: 'ATMOSPHERIC',
  volcanic: 'VOLCANIC',
  space_weather: 'SPACE WX',
  geomagnetic: 'GEOMAG',
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const mins = Math.round((now - then) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function AnomalyFeed({ anomalies, limit = 40 }: { anomalies: Anomaly[]; limit?: number }) {
  const glass = useGlassStyle();
  const shown = anomalies.slice(0, limit);

  return (
    <div style={{ flex: 1, minHeight: 0, padding: 16, borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em', color: '#e4e4e7', textTransform: 'uppercase', fontWeight: 600 }}>
          Anomaly Feed
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a' }}>
          {anomalies.length} in 24h
        </span>
      </div>

      {shown.length === 0 ? (
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: '#52525b', letterSpacing: '0.08em' }}>
          NO ANOMALIES DETECTED
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shown.map(a => (
            <div
              key={a.anomaly_id}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                borderLeft: `2px solid ${SEVERITY_COLOR[a.severity] || '#71717a'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color: SEVERITY_COLOR[a.severity] || '#e4e4e7', fontWeight: 700, textTransform: 'uppercase' }}>
                  {DOMAIN_LABEL[a.domain] || a.domain}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a' }}>{timeAgo(a.time)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e4e4e7', fontWeight: 600 }}>
                  {a.metric}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#a1a1aa' }}>
                  z={a.z_score.toFixed(1)}
                </span>
              </div>
              {a.description && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a', lineHeight: 1.4 }}>
                  {a.description}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
