import { useGlassStyle } from '../../utils/glass';
import type { ActivityAssessment } from '../../types';

const LEVEL_COLOR: Record<string, string> = {
  nominal: '#4ade80',
  elevated: '#fbbf24',
  high: '#fb923c',
  intense: '#f43f5e',
  unknown: '#71717a',
};

export function ActivityPanel({ activity }: { activity: ActivityAssessment | null }) {
  const glass = useGlassStyle();
  if (!activity) return null;

  const level = activity.activity_level || 'unknown';
  const color = LEVEL_COLOR[level] || '#71717a';
  const score = Math.max(0, Math.min(1, activity.activity_score || 0));

  return (
    <div style={{ padding: '14px 16px', borderRadius: 16, ...glass }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em', color: '#e4e4e7', textTransform: 'uppercase', fontWeight: 600 }}>
          Activity Level
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color, padding: '2px 10px', borderRadius: 9999,
            background: `${color}1f`,
          }}
        >
          {level}
        </span>
      </div>

      {/* Score bar */}
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${score * 100}%`, height: '100%', borderRadius: 2, background: color, transition: 'width 0.6s ease', boxShadow: `0 0 12px ${color}` }} />
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, fontFamily: 'var(--font-mono)' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7' }}>{activity.active_anomalies ?? 0}</div>
          <div style={{ fontSize: 8, color: '#71717a', letterSpacing: '0.08em' }}>ANOMALIES</div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7' }}>{activity.active_correlations ?? 0}</div>
          <div style={{ fontSize: 8, color: '#71717a', letterSpacing: '0.08em' }}>CORRELATIONS</div>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7' }}>
            {(activity.confidence != null ? activity.confidence * 100 : 0).toFixed(0)}%
          </div>
          <div style={{ fontSize: 8, color: '#71717a', letterSpacing: '0.08em' }}>CONFIDENCE</div>
        </div>
      </div>

      {/* Domains affected */}
      {activity.domains_affected && activity.domains_affected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
          {activity.domains_affected.map(d => (
            <span key={d} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#fbbf24', padding: '2px 8px', borderRadius: 9999, background: 'rgba(251,191,36,0.08)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {d}
            </span>
          ))}
        </div>
      )}

      {activity.summary && (
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#a1a1aa', lineHeight: 1.5, margin: '10px 0 0', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
          {activity.summary}
        </p>
      )}
    </div>
  );
}
