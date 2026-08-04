import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { useGlassStyle } from '../../utils/glass';
import { api } from '../../api/client';
import type { Narrative } from '../../types';

const SEVERITY_ACCENT: Record<string, string> = {
  critical: '#f43f5e',
  high: '#fb923c',
  medium: '#fbbf24',
  low: '#38bdf8',
};

const TYPE_ICON_LABEL: Record<string, string> = {
  nominal: 'STATUS NOMINAL',
  anomaly_observation: 'ANOMALY DETECTED',
  correlation_insight: 'CROSS-DOMAIN SIGNAL',
  cascade_warning: 'CASCADE WARNING',
};

export function NarrativePanel() {
  const glass = useGlassStyle();
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.getNarrative();
      setNarrative(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetch();
    const iv = setInterval(() => fetch(), 60000);
    return () => clearInterval(iv);
  }, []);

  const accent = narrative ? SEVERITY_ACCENT[narrative.severity] || '#71717a' : '#71717a';
  const typeLabel = narrative ? TYPE_ICON_LABEL[narrative.narrative_type] || 'OBSERVATION' : '';

  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 16,
        ...glass,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent glow */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          opacity: 0.6,
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles width={14} height={14} color={accent} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.15em',
              color: accent,
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            TETHYS SPEAKS
          </span>
        </div>
        <button
          onClick={() => fetch(true)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            display: 'flex',
            opacity: refreshing ? 0.4 : 0.6,
            transition: 'opacity 0.2s',
          }}
          title="Regenerate narrative"
        >
          <RefreshCw
            width={12}
            height={12}
            color="#71717a"
            style={{ animation: refreshing ? 'spin 1s linear' : undefined }}
          />
        </button>
      </div>

      {/* Type label */}
      {narrative && typeLabel && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            letterSpacing: '0.12em',
            color: '#52525b',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          {typeLabel}
        </div>
      )}

      {/* Narrative text */}
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.6,
          color: '#e4e4e7',
          margin: 0,
          fontStyle: 'italic',
        }}
      >
        {loading
          ? 'Reading planetary signatures…'
          : narrative?.text || 'No data available.'}
      </p>

      {/* Footer */}
      {narrative && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>
            {new Date(narrative.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC
          </span>
          {narrative.active_anomalies > 0 && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: accent }}>
              {narrative.active_anomalies} ACTIVE
            </span>
          )}
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
