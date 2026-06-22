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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function VolcanicCard() {
  const glass = useGlassStyle();
  const [events, setEvents] = useState<VolcanicEvent[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.getVolcanic();
        if (res?.events) setEvents(res.events.slice(0, 5));
      } catch {}
    };
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          Volcanic Activity
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>Source: NASA EONET</span>
      </div>

      {events.length === 0 ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#71717a', textAlign: 'center', padding: 8 }}>
          No active volcanoes
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((ev) => (
            <div key={ev.event_id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#fb923c', fontWeight: 700 }}>
                  {ev.volcano_name}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a' }}>
                  {timeAgo(ev.time)}
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#a1a1aa', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.description?.length > 100 ? ev.description.slice(0, 100) + '…' : ev.description || '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
