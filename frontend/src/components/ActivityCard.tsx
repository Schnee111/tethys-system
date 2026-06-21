import { useDataStore } from '../stores/dataStore';

export function ActivityCard() {
  const { activity, isLoading, anomalies } = useDataStore();
  const level = activity?.activity_level || 'unknown';
  const score = activity?.activity_score ?? 0;
  const confidence = activity?.confidence ?? 0;
  const isNoData = score === 0 && confidence < 0.1;
  const anomalyCount = activity?.active_anomalies ?? anomalies.length;

  return (
    <div style={{
      padding: '14px',
      borderRadius: '16px',
      background: 'rgba(255,255,255,0.06)',
      backdropFilter: 'blur(16px)',
      textAlign: 'left',
      fontSize: 10,
      color: '#71717a',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.5)', textTransform: 'uppercase', fontWeight: 600 }}>
          ACTIVITY INDEX
        </span>
        <span style={{ color: isNoData ? '#71717a' : 'rgba(52,211,153,0.8)', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 9 }}>
          {isLoading ? '...' : isNoData ? 'NO DATA' : level.toUpperCase()}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, marginBottom: 3 }}>
        <span>SCORE</span>
        <span style={{ color: isNoData ? '#71717a' : '#d4d4d8', fontWeight: 700 }}>{isNoData ? '—' : `${score.toFixed(2)} / 1.00`}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, marginBottom: 3 }}>
        <span>CONFIDENCE</span>
        <span style={{ color: isNoData ? '#71717a' : confidence < 0.2 ? '#fbbf24' : '#d4d4d8', fontWeight: 700 }}>{isNoData ? 'N/A' : confidence < 0.2 ? 'LOW' : `${(confidence * 100).toFixed(0)}%`}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
        <span>ANOMALIES</span>
        <span style={{ color: isNoData ? '#71717a' : '#d4d4d8', fontWeight: 700 }}>{anomalyCount}</span>
      </div>
    </div>
  );
}
