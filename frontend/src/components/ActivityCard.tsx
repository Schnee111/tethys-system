import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';

export function ActivityCard() {
  const { events, anomalies, status } = useDataStore();
  const { activeCategories, minMagnitude, maxMagnitude } = useGlobeStore();

  const sourceCount = status ? Object.keys(status.collectors).length : 0;
  const activeSources = status ? Object.values(status.collectors).filter((c: any) => c.status === 'ok').length : 0;

  // Filtered counts
  const filteredEvents = events.filter(e => {
    if (!activeCategories.has(e.domain)) return false;
    const mag = e.magnitude || 0;
    return mag >= minMagnitude && mag <= maxMagnitude;
  });
  const filteredAnomalies = anomalies.filter(a => {
    if (!activeCategories.has(a.domain)) return false;
    return (a.z_score || 0) >= minMagnitude;
  });

  const stats = [
    { label: 'Anomalies', value: filteredAnomalies.length, color: filteredAnomalies.length > 0 ? '#fbbf24' : '#4ade80' },
    { label: 'Events', value: filteredEvents.length, color: '#e4e4e7' },
    { label: 'Sources', value: `${activeSources}/${sourceCount}`, color: activeSources === sourceCount ? '#4ade80' : '#fbbf24' },
  ];

  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 12,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    }}>
      {stats.map((stat) => (
        <div key={stat.label} style={{ textAlign: 'center', flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            fontWeight: 700,
            color: stat.color,
            lineHeight: 1,
            marginBottom: 4,
          }}>
            {stat.value}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            color: '#71717a',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
