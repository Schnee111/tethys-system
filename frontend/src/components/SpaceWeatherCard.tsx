import { useEffect, useState } from 'react';
import { useGlassStyle } from '../utils/glass';
import { api } from '../api/client';

interface SpaceWeatherEvent {
  time: string;
  event_id: string;
  event_type: string;
  source: string;
  description: string;
  link: string;
}

interface SpaceWeatherData {
  count: number;
  events: SpaceWeatherEvent[];
}

const EVENT_COLORS: Record<string, string> = {
  CME: '#f59e0b',
  FLARE: '#ef4444',
};

function eventTypeColor(type: string): string {
  return EVENT_COLORS[type.toUpperCase()] || '#a78bfa';
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function SpaceWeatherCard() {
  const glass = useGlassStyle();
  const [data, setData] = useState<SpaceWeatherData | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.getSpaceWeather();
        if (res) setData(res);
      } catch {}
    };
    fetchData();
    const interval = setInterval(fetchData, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  const events = data?.events?.slice(0, 5) || [];

  return (
    <div style={{ padding: '14px', borderRadius: 16, ...glass, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, letterSpacing: '0.1em', color: 'rgba(161,161,170,0.8)', textTransform: 'uppercase', fontWeight: 600 }}>
          Space Weather
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>Source: NASA DONKI</span>
      </div>

      {events.length === 0 ? (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a', textAlign: 'center', padding: '8px 0' }}>
          No recent events
        </span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {events.map((ev) => {
            const color = eventTypeColor(ev.event_type);
            const shortDesc = ev.description?.length > 80
              ? ev.description.slice(0, 80) + '…'
              : ev.description || '';
            return (
              <div key={ev.event_id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700,
                    color, textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: `${color}18`, padding: '2px 6px', borderRadius: 4,
                  }}>
                    {ev.event_type}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a' }}>
                    {timeAgo(ev.time)}
                  </span>
                </div>
                {shortDesc && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#e4e4e7', lineHeight: 1.4 }}>
                    {shortDesc}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
