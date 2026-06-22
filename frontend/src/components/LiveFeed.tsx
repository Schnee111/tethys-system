import { useState, useEffect, useMemo } from 'react';
import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { magnitudeColor, DOMAIN_COLORS } from '../utils/colors';
import { api } from '../api/client';
import type { PlanetaryEvent } from '../types';

const TIME_RANGES = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 168 },
  { label: '30d', hours: 720 },
  { label: 'All', hours: 8760 },
];

function formatTime(time: string): string {
  try { return new Date(time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }); }
  catch { return time?.substring(11, 16) || ''; }
}

export function LiveFeed() {
  const { events: wsEvents, isLoading } = useDataStore();
  const { activeCategories, minMagnitude, maxMagnitude } = useGlobeStore();
  const { selectedEvent, setSelectedEvent } = useGlobeStore();

  const [timeRange, setTimeRange] = useState(0); // index into TIME_RANGES
  const [restEvents, setRestEvents] = useState<PlanetaryEvent[]>([]);

  const range = TIME_RANGES[timeRange];

  // Fetch historical data when range > 24h
  useEffect(() => {
    if (range.hours <= 24) {
      setRestEvents([]);
      return;
    }

    const fetchHistory = async () => {
      try {
        const [seismicRes, volcanicRes] = await Promise.all([
          api.getSeismic({ hours: range.hours, limit: 1000 }),
          api.getVolcanic(),
        ]);

        const seismic = (seismicRes.events || []).map((e: any) => ({
          ...e,
          domain: 'seismic' as const,
          title: `M${e.magnitude?.toFixed(1) || '?'} — ${e.place || 'Unknown'}`,
          location: e.place || 'Unknown',
          severity: (e.magnitude || 0) >= 5 ? 'high' as const : (e.magnitude || 0) >= 3 ? 'medium' as const : 'low' as const,
        }));

        const volcanic = (volcanicRes.events || [])
          .filter((v: any) => {
            const age = Date.now() - new Date(v.time).getTime();
            return age < range.hours * 3600000;
          })
          .map((v: any) => ({
            time: v.time,
            event_id: v.event_id,
            domain: 'volcanic' as const,
            title: v.volcano_name || 'Volcanic Event',
            location: v.volcano_name || 'Unknown',
            latitude: v.latitude,
            longitude: v.longitude,
            description: v.description || '',
            severity: 'medium' as const,
            elevation_m: v.elevation_m,
            vei: v.vei,
            link: v.link,
          }));

        setRestEvents([...seismic, ...volcanic]);
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    };

    fetchHistory();
  }, [range.hours]);

  // Merge: WS events (recent) + REST events (historical), dedup by event_id
  const allEvents = useMemo(() => {
    if (range.hours <= 24) return wsEvents;

    const merged = new Map<string, PlanetaryEvent>();
    for (const e of wsEvents) merged.set(e.event_id, e);
    for (const e of restEvents) {
      if (!merged.has(e.event_id)) merged.set(e.event_id, e);
    }
    return Array.from(merged.values()).sort((a, b) =>
      new Date(b.time).getTime() - new Date(a.time).getTime()
    );
  }, [wsEvents, restEvents, range.hours]);

  // Apply filters
  const filteredEvents = useMemo(() => allEvents.filter(e => {
    if (!activeCategories.has(e.domain)) return false;
    // Magnitude filter only for events that have magnitude
    if (e.magnitude != null) {
      if (e.magnitude < minMagnitude || e.magnitude > maxMagnitude) return false;
    }
    return true;
  }), [allEvents, activeCategories, minMagnitude, maxMagnitude]);

  return (
    <>
      {/* Event Detail */}
      <AnimatePresence mode="wait">
        {selectedEvent && (
          <motion.div
            key={`detail-${selectedEvent.event_id}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden', textAlign: 'left', padding: '14px 0 10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  padding: '1px 8px', borderRadius: 9999, fontSize: 8,
                  fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em',
                  background: 'rgba(255,255,255,0.08)', textTransform: 'uppercase',
                  color: DOMAIN_COLORS[selectedEvent.domain] || '#a1a1aa',
                }}>
                  {selectedEvent.domain}
                </span>
                <button onClick={() => setSelectedEvent(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52525b', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                  <X style={{ width: 10, height: 10 }} />
                </button>
              </div>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: '#e4e4e7', margin: 0 }}>
                {selectedEvent.title}
              </h4>
              {/* Metadata grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#52525b' }}>Time</span>
                  <span style={{ color: '#a1a1aa' }}>{formatTime(selectedEvent.time)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#52525b' }}>Coords</span>
                  <span style={{ color: '#a1a1aa' }}>{selectedEvent.latitude?.toFixed(2)}, {selectedEvent.longitude?.toFixed(2)}</span>
                </div>
                {selectedEvent.depth_km != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#52525b' }}>Depth</span>
                    <span style={{ color: '#a1a1aa' }}>{selectedEvent.depth_km.toFixed(1)} km</span>
                  </div>
                )}
                {selectedEvent.sig != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#52525b' }}>Sig</span>
                    <span style={{ color: '#a1a1aa' }}>{selectedEvent.sig}</span>
                  </div>
                )}
                {selectedEvent.felt != null && selectedEvent.felt > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#52525b' }}>Felt</span>
                    <span style={{ color: '#a1a1aa' }}>{selectedEvent.felt} reports</span>
                  </div>
                )}
                {selectedEvent.alert && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#52525b' }}>Alert</span>
                    <span style={{
                      color: selectedEvent.alert === 'red' ? '#ef4444' : selectedEvent.alert === 'orange' ? '#f59e0b' : selectedEvent.alert === 'yellow' ? '#eab308' : '#4ade80',
                      fontWeight: 700,
                    }}>
                      {selectedEvent.alert.toUpperCase()}
                    </span>
                  </div>
                )}
                {selectedEvent.tsunami === 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gridColumn: '1 / -1' }}>
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>TSUNAMI WARNING</span>
                  </div>
                )}
                {/* Volcanic-specific */}
                {selectedEvent.elevation_m != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#52525b' }}>Elevation</span>
                    <span style={{ color: '#a1a1aa' }}>{selectedEvent.elevation_m.toFixed(0)} m</span>
                  </div>
                )}
                {selectedEvent.vei != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#52525b' }}>VEI</span>
                    <span style={{ color: '#a1a1aa' }}>{selectedEvent.vei}</span>
                  </div>
                )}
                {selectedEvent.link && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <a
                      href={selectedEvent.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#60a5fa', textDecoration: 'none' }}
                    >
                      View on GVP
                    </a>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with time range selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.25em', color: 'rgba(161,161,170,0.6)', textTransform: 'uppercase', fontWeight: 600 }}>
          LIVE FEED
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a' }}>
            {filteredEvents.length} events
          </span>
          {/* Time range tabs */}
          <div style={{ display: 'flex', gap: 2 }}>
            {TIME_RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setTimeRange(i)}
                style={{
                  background: timeRange === i ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 8,
                  color: timeRange === i ? '#e4e4e7' : '#3f3f46',
                  fontWeight: timeRange === i ? 700 : 400,
                  transition: 'all 0.15s',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite', boxShadow: '0 0 8px rgba(239,68,68,0.5)' }} />
        </div>
      </div>

      {/* Events */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 192, color: '#71717a', fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52525b', animation: 'pulse 2s infinite', marginBottom: 12 }} />
            Connecting...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 192, color: '#71717a', fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#52525b', animation: 'pulse 2s infinite', marginBottom: 12 }} />
            No signals
          </div>
        ) : (
          filteredEvents.slice(0, 100).map((event) => {
            const isSelected = selectedEvent?.event_id === event.event_id && selectedEvent?.time === event.time;
            return (
              <div
                key={`${event.event_id}-${event.time}`}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                  transition: 'background 0.15s',
                  textAlign: 'left',
                  marginBottom: 4,
                }}
                onClick={() => setSelectedEvent(event)}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#71717a' }}>[{formatTime(event.time)}]</span>
                    <span style={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: 9, textTransform: 'uppercase', color: DOMAIN_COLORS[event.domain] || '#a1a1aa' }}>
                      {event.domain}
                    </span>
                  </div>
                  {event.magnitude != null && (
                    <span style={{ fontSize: 9, color: magnitudeColor(event.magnitude), fontFamily: 'var(--font-mono)' }}>
                      M{event.magnitude.toFixed(1)}
                    </span>
                  )}
                </div>
                <p style={{ color: '#d4d4d8', fontSize: 11, fontWeight: 300, lineHeight: 1.25, margin: 0 }}>
                  {event.title}
                </p>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
