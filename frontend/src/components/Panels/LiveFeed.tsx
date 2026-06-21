import { useDataStore } from '../../stores/dataStore';
import { useGlobeStore } from '../../stores/globeStore';

export function LiveFeed() {
  const { events, isLoading } = useDataStore();
  const { selectedEvent, setSelectedEvent } = useGlobeStore();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-2">
        <span className="text-[10px] tracking-[0.25em] text-zinc-400/60 uppercase font-semibold">
          LIVE FEED
        </span>
        <span className="font-mono text-[9px] text-zinc-500">
          {events.length} events
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none space-y-2">
        {isLoading ? (
          <div className="text-[11px] text-zinc-500 p-3">Connecting to API...</div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-[11px] font-mono">
            <div className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse mb-3" />
            No events — start the backend
          </div>
        ) : (
          events.slice(0, 50).map((event) => {
            const isSelected = selectedEvent?.event_id === event.event_id;
            return (
              <div
                key={event.event_id}
                className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'bg-white/[0.06]'
                    : 'bg-transparent hover:bg-white/[0.02]'
                }`}
                onClick={() => setSelectedEvent(event)}
              >
                <div
                  className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-opacity"
                  style={{
                    backgroundColor: getDomainColor(event.domain),
                    opacity: isSelected ? 1 : 0,
                  }}
                />
                <div className="flex items-center justify-between mb-1 font-mono text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">{formatTime(event.time)}</span>
                    <span
                      className="font-bold tracking-widest text-[9px] uppercase"
                      style={{ color: getDomainColor(event.domain) }}
                    >
                      {event.domain}
                    </span>
                  </div>
                </div>
                <p className="text-zinc-300 text-sm font-light leading-tight group-hover:text-white transition-colors">
                  {event.title || event.description?.substring(0, 60)}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
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
