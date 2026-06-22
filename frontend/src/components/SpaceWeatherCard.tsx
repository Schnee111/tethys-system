import { useEffect, useState } from 'react';
import { useGlassStyle } from '../utils/glass';
import { api } from '../api/client';

interface SpaceEvent {
  time: string;
  event_id: string;
  event_type: string;
  source: string;
  description: string;
  link: string;
}

function eventTypeColor(type: string): string {
  if (type === 'CME') return '#f59e0b';
  if (type === 'FLARE') return '#ef4444';
  return '#a78bfa';
}

function timeAgo(time: string): string {
  const diff = Date.now() - new Date(time).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SpaceWeatherCard() {
  const glass = useGlassStyle();
  const [data, setData] = useState<{ events: SpaceEvent[] } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.getSpaceWeather();
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
          Space Weather
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>NASA DONKI</span>
      </div>

      {events.length === 0 ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#52525b', textAlign: 'center', padding: '8px 0' }}>
          No recent events
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 320, overflowY: 'auto' }}>
          {events.map((ev) => {
            const color = eventTypeColor(ev.event_type);
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
                {/* Row: badge + time */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700,
                      color, textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: `${color}15`, padding: '1px 6px', borderRadius: 3,
                    }}>
                      {ev.event_type}
                    </span>
                    {ev.source && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#3f3f46' }}>
                        {ev.source}
                      </span>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>
                    {timeAgo(ev.time)}
                  </span>
                </div>

                {/* Description — truncated or full */}
                <p style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: '#a1a1aa',
                  lineHeight: 1.5, margin: 0,
                  overflow: 'hidden',
                  display: isExpanded ? 'block' : '-webkit-box',
                  WebkitLineClamp: isExpanded ? undefined : 2,
                  WebkitBoxOrient: 'vertical',
                }}>
                  {ev.description || 'No description.'}
                </p>

                {/* Link — only when expanded */}
                {isExpanded && ev.link && (
                  <a
                    href={ev.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'inline-block', marginTop: 6,
                      fontFamily: 'var(--font-mono)', fontSize: 8, color: '#60a5fa',
                      textDecoration: 'none',
                    }}
                  >
                    View on NASA DONKI
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
