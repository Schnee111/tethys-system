import { useState } from 'react';
import { useDataStore } from '../stores/dataStore';
import type { Anomaly } from '../types';

function severityColor(z: number): string {
  return z >= 4 ? '#ef4444' : z >= 3 ? '#f97316' : z >= 2 ? '#eab308' : '#71717a';
}

function AnomalyItem({ a }: { a: Anomaly }) {
  const [hovered, setHovered] = useState(false);
  const z = a.z_score ?? 0;
  const dotColor = severityColor(z);
  const valueColor = severityColor(z);

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
        <p style={{ fontSize: 10, color: '#d4d4d8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {a.description}
        </p>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: valueColor }}>
          {a.metric}: {typeof a.value === 'number' ? a.value.toFixed(2) : a.value}
        </span>
      </div>
    </div>
  );
}

export function AnomalyPanel() {
  const { anomalies, isLoading } = useDataStore();

  return (
    <div style={{
      padding: '14px',
      borderRadius: '16px',
      background: 'rgba(255,255,255,0.06)',
      backdropFilter: 'blur(16px)',
      textAlign: 'left',
      flex: '1 1 0',
      minHeight: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          ANOMALIES ({anomalies.length})
        </span>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(251,191,36,0.8)', animation: 'pulse 2s infinite' }} />
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {isLoading ? (
          <div style={{ fontSize: 10, color: '#71717a', fontFamily: 'var(--font-mono)' }}>Loading...</div>
        ) : anomalies.length === 0 ? (
          <div style={{ fontSize: 10, color: '#71717a', fontFamily: 'var(--font-mono)' }}>No anomalies detected</div>
        ) : (
          <>
            {anomalies.slice(0, 15).map((a) => (
              <AnomalyItem key={a.anomaly_id} a={a} />
            ))}
            {anomalies.length > 15 && (
              <div style={{ fontSize: 9, color: 'rgba(161,161,170,0.5)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '6px 0' }}>
                +{anomalies.length - 15} more
              </div>
            )}
          </>
        )}
      </div>

      {/* Severity Legend */}
      <div style={{
        display: 'flex',
        gap: 10,
        justifyContent: 'center',
        paddingTop: 8,
        marginTop: 4,
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        {[
          { label: '<2', color: '#71717a' },
          { label: '2-3', color: '#eab308' },
          { label: '3-4', color: '#f97316' },
          { label: '4+', color: '#ef4444' },
        ].map((item) => (
          <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
            <span style={{ fontSize: 8, color: 'rgba(161,161,170,0.5)', fontFamily: 'var(--font-mono)' }}>{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
