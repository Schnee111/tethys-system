import { useState } from 'react';
import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';
import { useGlassStyle } from '../utils/glass';
import type { Anomaly } from '../types';
import { severityColor } from '../utils/colors';

function AnomalyItem({ a }: { a: Anomaly }) {
  const [hovered, setHovered] = useState(false);
  const z = a.z_score ?? 0;
  const dotColor = severityColor(a.severity);
  const valueColor = severityColor(a.severity);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 8px',
        margin: '0 -8px',
        borderRadius: 6,
        cursor: 'pointer',
        background: hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{ width: 4, height: 4, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: dotColor }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {a.domain}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a' }}>
            z={a.z_score?.toFixed(1)}
          </span>
        </div>
        <p style={{ fontSize: 10, color: '#a1a1aa', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {a.description}
        </p>
      </div>
    </div>
  );
}

export function AnomalyPanel() {
  const { anomalies, isLoading } = useDataStore();
  const { activeCategories, minMagnitude } = useGlobeStore();
  const glass = useGlassStyle();

  const filtered = anomalies.filter(a => {
    if (!activeCategories.has(a.domain)) return false;
    if ((a.z_score || 0) < minMagnitude) return false;
    return true;
  });

  return (
    <div style={{
      padding: '14px',
      borderRadius: '16px',
      ...glass,
      backdropFilter: 'blur(16px)',
      textAlign: 'left',
      flex: '1 1 0',
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          ANOMALIES ({filtered.length})
        </span>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(251,191,36,0.8)', animation: 'pulse 2s infinite' }} />
      </div>
      <div style={{ fontSize: 10, color: 'rgba(161,161,170,0.5)', marginBottom: 12 }}>
        Statistical outliers (z &gt; 2.5)
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {isLoading ? (
          <div style={{ fontSize: 10, color: '#71717a', fontFamily: 'var(--font-mono)' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ fontSize: 10, color: '#71717a', fontFamily: 'var(--font-mono)' }}>No anomalies detected</div>
        ) : (
          <>
            {filtered.slice(0, 15).map((a) => (
              <AnomalyItem key={a.anomaly_id} a={a} />
            ))}
            {filtered.length > 15 && (
              <div style={{ fontSize: 9, color: 'rgba(161,161,170,0.5)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '6px 0' }}>
                +{filtered.length - 15} more
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
