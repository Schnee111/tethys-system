import { useEffect, useState } from 'react';
import { useGlassStyle } from '../utils/glass';
import { api } from '../api/client';

interface VolcanicEvent {
  time: string;
  event_id: string;
  volcano_name: string;
  latitude: number;
  longitude: number;
  description: string;
  link: string;
}

function timeAgo(time: string): string {
  const diff = Date.now() - new Date(time).getTime();
  const d = Math.floor(diff / 86400000);
  if (d < 1) return 'today';
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export function VolcanicCard() {
  const glass = useGlassStyle();
  const [data, setData] = useState<{ events: VolcanicEvent[] } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.getVolcanic();
        if (res) setData(res);
      } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 300000);
    return () => clearInterval(interval);
  }, []);

  const events = data?.events || [];

  return (
    <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          Volcanic Activity
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>NASA EONET</span>
      </div>

      {events.length === 0 ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#52525b', textAlign: 'center', padding: '8px 0' }}>
          No active volcanoes
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 260, overflowY: 'auto' }}>
          {events.map((ev) => {
            const isExpanded = expandedId === ev.event_id;
            return (
              <div
                key={ev.event_id}
                onClick={() => setExpandedId(isExpanded ? null : ev.event_id)}
                style={{
                  cursor: 'pointer',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                {/* Row: name + time */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#fb923c', fontWeight: 600 }}>
                    {ev.volcano_name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>
                    {timeAgo(ev.time)}
                  </span>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#a1a1aa', lineHeight: 1.5 }}>
                      {ev.description || 'No description.'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>
                      {ev.latitude.toFixed(2)}, {ev.longitude.toFixed(2)}
                    </span>
                    {ev.link && (
                      <a
                        href={ev.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontFamily: 'var(--font-mono)', fontSize: 8, color: '#60a5fa',
                          textDecoration: 'none',
                        }}
                      >
                        View on GVP
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
