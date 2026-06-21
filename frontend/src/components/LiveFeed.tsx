import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { magnitudeColor, DOMAIN_COLORS } from '../utils/colors';

function formatTime(time: string): string {
  try { return new Date(time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }); }
  catch { return time?.substring(11, 16) || ''; }
}

export function LiveFeed() {
  const { events, isLoading } = useDataStore();
  const { activeCategories } = useGlobeStore();
  const filteredEvents = events.filter(e => activeCategories.has(e.domain));
  const { selectedEvent, setSelectedEvent } = useGlobeStore();

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
            style={{ overflow: 'hidden', background: 'rgba(255,255,255,0.06)', borderRadius: 12, textAlign: 'left' }}
          >
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{
                  padding: '2px 10px', borderRadius: 9999, fontSize: 9,
                  fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em',
                  background: 'rgba(255,255,255,0.10)', textTransform: 'uppercase',
                  color: DOMAIN_COLORS[selectedEvent.domain] || '#a1a1aa',
                }}>
                  {selectedEvent.domain}
                </span>
                <button onClick={() => setSelectedEvent(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>
              <h4 style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em', color: '#fff', margin: '0 0 4px 0' }}>
                {selectedEvent.title}
              </h4>
              <p style={{ color: '#a1a1aa', fontSize: 10, margin: '0 0 8px 0' }}>{selectedEvent.location}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8, padding: '6px 0', fontFamily: 'var(--font-mono)', fontSize: 8, color: '#a1a1aa' }}>
                <div>
                  <div style={{ color: '#71717a' }}>TIMESTAMP</div>
                  <div style={{ color: '#d4d4d8', fontWeight: 700 }}>{formatTime(selectedEvent.time)}</div>
                </div>
                <div>
                  <div style={{ color: '#71717a' }}>COORDINATES</div>
                  <div style={{ color: '#d4d4d8', fontWeight: 700 }}>
                    {selectedEvent.latitude?.toFixed(1)}°, {selectedEvent.longitude?.toFixed(1)}°
                  </div>
                </div>
              </div>
              <p style={{ fontSize: 10, color: '#d4d4d8', lineHeight: 1.5, fontWeight: 300, maxHeight: 80, overflowY: 'auto', margin: 0 }}>
                {selectedEvent.description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.25em', color: 'rgba(161,161,170,0.6)', textTransform: 'uppercase', fontWeight: 600 }}>
          LIVE FEED
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a', fontWeight: 500 }}>{filteredEvents.length} events · Last 24h</span>
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
          filteredEvents.slice(0, 50).map((event) => {
            const isSelected = selectedEvent?.event_id === event.event_id && selectedEvent?.time === event.time;
            return (
              <div
                key={`${event.event_id}-${event.time}`}
                style={{
                  position: 'relative',
                  padding: 12,
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                  transition: 'all 0.3s',
                  textAlign: 'left',
                  marginBottom: 8,
                }}
                onClick={() => setSelectedEvent(event)}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{
                  position: 'absolute', left: 0, top: 8, bottom: 8, width: 2, borderRadius: 1,
                  background: DOMAIN_COLORS[event.domain] || '#a1a1aa',
                  opacity: isSelected ? 1 : 0,
                  transition: 'opacity 0.3s',
                }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#71717a' }}>[{formatTime(event.time)}]</span>
                    <span style={{ fontWeight: 700, letterSpacing: '0.1em', fontSize: 9, textTransform: 'uppercase', color: DOMAIN_COLORS[event.domain] || '#a1a1aa' }}>
                      {event.domain}
                    </span>
                  </div>
                  {event.magnitude && (
                    <span style={{ fontSize: 9, color: magnitudeColor(event.magnitude), fontFamily: 'var(--font-mono)' }}>
                      M{event.magnitude.toFixed(1)}
                    </span>
                  )}
                </div>
                <p style={{ color: '#d4d4d8', fontSize: 13, fontWeight: 300, lineHeight: 1.25, margin: 0 }}>
                  {event.title}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Telemetry */}
      <div style={{ paddingTop: 12, fontFamily: 'var(--font-mono)', fontSize: 9, color: '#71717a', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>ATMOSPHERE</span>
          <span style={{ color: '#a1a1aa' }}>1013 HPA [NORM]</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span>SOLAR FLUX</span>
          <span style={{ color: '#52525b' }}>NO DATA</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>CRUSTAL PRESSURE</span>
          <span style={{ color: '#52525b' }}>NO DATA</span>
        </div>
      </div>
    </>
  );
}
