import { useDataStore } from '../../stores/dataStore';
import { useGlobeStore } from '../../stores/globeStore';

export function LiveFeed() {
  const { events, isLoading } = useDataStore();
  const { selectedEvent, setSelectedEvent } = useGlobeStore();

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between pb-2">
        <span className="font-sans text-[10px] tracking-[0.25em] text-zinc-400/60 uppercase font-semibold">
          LIVE FEED
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] text-zinc-500 font-medium">
            {events.length} events
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
        </div>
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 scrollbar-none pr-1" style={{ scrollbarWidth: 'none' }}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-[10px] font-mono uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse mb-3" />
            Connecting...
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-[10px] font-mono uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse mb-3" />
            No signals — start backend
          </div>
        ) : (
          events.slice(0, 50).map((event) => {
            const isSelected = selectedEvent?.event_id === event.event_id;
            return (
              <div
                key={event.event_id}
                className={`group relative p-3 rounded-xl transition-all duration-300 cursor-pointer text-left ${
                  isSelected
                    ? 'bg-white/[0.06] shadow-lg shadow-black/20'
                    : 'bg-transparent hover:bg-white/[0.02]'
                }`}
                onClick={() => setSelectedEvent(event)}
              >
                {/* Left accent line */}
                <div
                  className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-opacity duration-300 ${
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                  }`}
                  style={{ backgroundColor: getDomainColor(event.domain) }}
                />

                {/* Timestamp + domain */}
                <div className="flex items-center justify-between mb-1 font-mono text-[11px] tabular-nums">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">{formatTime(event.time)}</span>
                    <span
                      className="font-bold tracking-widest text-[9px] uppercase"
                      style={{ color: getDomainColor(event.domain) }}
                    >
                      {event.domain}
                    </span>
                  </div>
                  {event.magnitude && (
                    <span className="text-[9px] text-zinc-600 group-hover:text-zinc-400 transition-colors font-mono">
                      M{event.magnitude.toFixed(1)}
                    </span>
                  )}
                </div>

                {/* Title */}
                <p className="text-zinc-300 text-sm font-light leading-tight font-sans group-hover:text-white transition-colors">
                  {event.title}
                </p>

                {/* Description */}
                {event.description && (
                  <p className="text-[10px] text-zinc-500 mt-1 leading-tight font-mono">
                    {event.description}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

function getDomainColor(domain: string): string {
  const colors: Record<string, string> = {
    seismic: '#f87171',
    solar_wind: '#fbbf24',
    goes: '#a78bfa',
    atmospheric: '#60a5fa',
    volcanic: '#fb923c',
    space_weather: '#34d399',
  };
  return colors[domain] || '#a1a1aa';
}

function formatTime(time: string): string {
  try {
    return new Date(time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  } catch {
    return time?.substring(11, 16) || '';
  }
}
