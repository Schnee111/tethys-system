import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.getVolcanic();
        if (res?.events) setEvents(res.events);
      } catch {}
    };
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (eventId: string) => {
    setExpandedId((prev) => (prev === eventId ? null : eventId));
  };

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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: events.length > 4 ? 260 : undefined,
            overflowY: events.length > 4 ? 'auto' : undefined,
            paddingRight: events.length > 4 ? 4 : 0,
          }}
        >
          {events.map((ev) => {
            const isExpanded = expandedId === ev.event_id;
            const volcanoLink = `https://volcano.si.edu/volcano.cfm?vn=${ev.event_id}`;

            return (
              <div
                key={ev.event_id}
                onClick={() => toggleExpand(ev.event_id)}
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#fb923c', fontWeight: 700 }}>
                    {ev.volcano_name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#71717a' }}>
                    {timeAgo(ev.time)}
                  </span>
                </div>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#a1a1aa', lineHeight: 1.4 }}>
                          {ev.description || '—'}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>
                          📍 {ev.latitude.toFixed(2)}, {ev.longitude.toFixed(2)}
                        </span>
                        <a
                          href={ev.link || volcanoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#60a5fa', textDecoration: 'underline', wordBreak: 'break-all' }}
                        >
                          View on volcano.si.edu ↗
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
