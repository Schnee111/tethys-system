import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { magnitudeColor, DOMAIN_COLORS } from '../utils/colors';
import { getGlobe } from './EarthGlobe';

function formatTime(time: string): string {
  try { return new Date(time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }); }
  catch { return time?.substring(11, 16) || ''; }
}

export function LiveFeed() {
  const { events, isLoading } = useDataStore();
  const { activeCategories, minMagnitude, maxMagnitude } = useGlobeStore();
  const filteredEvents = events.filter(e => {
    if (!activeCategories.has(e.domain)) return false;
    const mag = e.magnitude || 0;
    if (mag < minMagnitude || mag > maxMagnitude) return false;
    return true;
  });
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
            style={{ overflow: 'hidden', textAlign: 'left', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
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
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#52525b', display: 'flex', gap: 12 }}>
                <span>{formatTime(selectedEvent.time)}</span>
                <span>{selectedEvent.latitude?.toFixed(1)}°, {selectedEvent.longitude?.toFixed(1)}°</span>
                {selectedEvent.depth_km && <span>{selectedEvent.depth_km.toFixed(1)}km</span>}
              </div>
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
                  padding: 10,
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                  transition: 'background 0.15s',
                  textAlign: 'left',
                  marginBottom: 4,
                }}
                onClick={() => {
                  setSelectedEvent(event);
                  // Fly globe to event location
                  const globe = getGlobe();
                  if (globe) {
                    globe.controls().autoRotate = false;
                    globe.pointOfView({ lat: event.latitude, lng: event.longitude, altitude: 1.5 }, 1000);
                  }
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
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
