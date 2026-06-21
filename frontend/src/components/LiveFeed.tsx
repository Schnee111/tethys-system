import { useDataStore } from '../stores/dataStore';
import { useGlobeStore } from '../stores/globeStore';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Zap, Wind } from 'lucide-react';

const DOMAIN_COLORS: Record<string, string> = {
  seismic: '#f87171',
  solar_wind: '#fbbf24',
  goes: '#a78bfa',
  atmospheric: '#60a5fa',
  volcanic: '#fb923c',
  space_weather: '#34d399',
};

function formatTime(time: string): string {
  try { return new Date(time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }); }
  catch { return time?.substring(11, 16) || ''; }
}

export function LiveFeed() {
  const { events, isLoading } = useDataStore();
  const { selectedEvent, setSelectedEvent } = useGlobeStore();

  return (
    <>
      {/* Event Detail — shows when an event is selected */}
      <AnimatePresence mode="wait">
        {selectedEvent && (
          <motion.div
            key={`detail-${selectedEvent.event_id}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-white/5 rounded-xl text-left"
          >
            <div className="p-4 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <span
                  className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-widest bg-white/10 uppercase"
                  style={{ color: DOMAIN_COLORS[selectedEvent.domain] || '#a1a1aa' }}
                >
                  {selectedEvent.domain}
                </span>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="font-mono text-[9px] tracking-widest uppercase text-zinc-400 hover:text-white cursor-pointer"
                >
                  [CLOSE]
                </button>
              </div>
              <h4 className="text-xs font-semibold tracking-tight text-white mb-1">
                {selectedEvent.title}
              </h4>
              <p className="text-zinc-400 text-[10px] mb-2">{selectedEvent.location}</p>
              <div className="grid grid-cols-2 gap-2 mb-2 py-1.5 font-mono text-[8px] text-zinc-400">
                <div>
                  <div className="text-zinc-500">TIMESTAMP</div>
                  <div className="text-zinc-300 font-bold">{formatTime(selectedEvent.time)}</div>
                </div>
                <div>
                  <div className="text-zinc-500">COORDINATES</div>
                  <div className="text-zinc-300 font-bold">
                    {selectedEvent.latitude?.toFixed(1)}°, {selectedEvent.longitude?.toFixed(1)}°
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-zinc-300 leading-normal font-light max-h-20 overflow-y-auto scrollbar-none">
                {selectedEvent.description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <span className="font-sans text-[10px] tracking-[0.25em] text-zinc-400/60 uppercase font-semibold">
          LIVE FEED
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] text-zinc-500 font-medium">{events.length} events</span>
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
        </div>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 scrollbar-none pr-1" style={{ scrollbarWidth: 'none' }}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-[10px] font-mono uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse mb-3" />
            Connecting...
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-[10px] font-mono uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse mb-3" />
            No signals
          </div>
        ) : (
          events.slice(0, 50).map((event) => {
            const isSelected = selectedEvent?.event_id === event.event_id;
            return (
              <div
                key={`${event.event_id}-${event.time}`}
                className={`group relative p-3 rounded-xl transition-all duration-300 cursor-pointer text-left ${
                  isSelected ? 'bg-white/[0.06] shadow-lg shadow-black/20' : 'bg-transparent hover:bg-white/[0.02]'
                }`}
                onClick={() => setSelectedEvent(event)}
              >
                <div
                  className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}
                  style={{ backgroundColor: DOMAIN_COLORS[event.domain] || '#a1a1aa' }}
                />
                <div className="flex items-center justify-between mb-1 font-mono text-[11px] tabular-nums">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">[{formatTime(event.time)}]</span>
                    <span className="font-bold tracking-widest text-[9px] uppercase" style={{ color: DOMAIN_COLORS[event.domain] || '#a1a1aa' }}>
                      {event.domain}
                    </span>
                  </div>
                  {event.magnitude && (
                    <span className="text-[9px] text-zinc-600 group-hover:text-zinc-400 transition-colors font-mono">
                      M{event.magnitude.toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="text-zinc-300 text-sm font-light leading-tight font-sans group-hover:text-white transition-colors">
                  {event.title}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Telemetry section — bottom of right panel */}
      <div className="pt-3 font-mono text-[9px] text-zinc-500 space-y-1.5 border-t border-white/5">
        <div className="flex justify-between">
          <span>ATMOSPHERE</span>
          <span className="text-zinc-400">1013 HPA [NORM]</span>
        </div>
        <div className="flex justify-between">
          <span>SOLAR FLUX</span>
          <span className="text-amber-500">—</span>
        </div>
        <div className="flex justify-between">
          <span>CRUSTAL PRESSURE</span>
          <span className="text-rose-400">—</span>
        </div>
      </div>
    </>
  );
}
