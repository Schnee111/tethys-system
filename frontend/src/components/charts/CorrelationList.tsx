import { useEffect, useState } from 'react';
import { useGlassStyle } from '../../utils/glass';
import { api } from '../../api/client';
import type { Correlation } from '../../types';

function domainLabel(d: string): string {
  return d.replace(/_/g, ' ').toUpperCase();
}

export function CorrelationList({ hours = 168 }: { hours?: number }) {
  const glass = useGlassStyle();
  const [items, setItems] = useState<Correlation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const fetch = async () => {
      try {
        const { correlations } = await api.getCorrelations({ hours, significant_only: false });
        if (alive) setItems(correlations);
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetch();
    const iv = setInterval(fetch, 60000);
    return () => { alive = false; clearInterval(iv); };
  }, [hours]);

  return (
    <div style={{ padding: '14px 16px', borderRadius: 16, ...glass }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.15em', color: '#e4e4e7', textTransform: 'uppercase', fontWeight: 600 }}>
          Cross-Domain Correlations
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a' }}>
          {loading ? 'LOADING' : `${items.length} found`}
        </span>
      </div>

      {items.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 64, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#52525b', letterSpacing: '0.08em' }}>
          {loading ? 'SCANNING…' : 'NO SIGNIFICANT CORRELATIONS — DATA ACCUMULATING'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
          {items.map(c => {
            const sig = c.is_significant;
            const r = c.pearson_r;
            return (
              <div
                key={c.correlation_id}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: sig ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.03)',
                  borderLeft: `2px solid ${sig ? '#fbbf24' : '#52525b'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', color: '#e4e4e7' }}>
                    {domainLabel(c.domain_a)} <span style={{ color: '#52525b' }}>·</span> {domainLabel(c.domain_b)}
                  </span>
                  {sig && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#fbbf24', fontWeight: 700 }}>SIGNIFICANT</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 3 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: r > 0 ? '#4ade80' : '#38bdf8' }}>
                    r={r.toFixed(3)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a' }}>
                    ρ={c.spearman_rho?.toFixed(3)} p={c.p_value.toExponential(1)} n={c.sample_size}
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b', marginTop: 2 }}>
                  lag {c.lag_hours}h · window {c.window_hours}h
                  {c.granger_causal ? ' · GRANGER-CAUSAL' : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
