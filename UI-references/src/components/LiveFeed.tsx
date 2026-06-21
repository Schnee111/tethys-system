import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, AlertCircle, Activity, Zap, Wind } from 'lucide-react';
import { PlanetaryEvent } from '../types';

interface LiveFeedProps {
  events: PlanetaryEvent[];
  selectedEvent: PlanetaryEvent | null;
  onSelectEvent: (event: PlanetaryEvent) => void;
  activeCategories: Set<string>;
}

export default function LiveFeed({
  events,
  selectedEvent,
  onSelectEvent,
  activeCategories,
}: LiveFeedProps) {

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'seismic':
        return {
          text: 'text-rose-400',
          badgeText: '#f87171',
        };
      case 'solar':
        return {
          text: 'text-amber-400',
          badgeText: '#fbbf24',
        };
      case 'atmospheric':
        return {
          text: 'text-sky-400',
          badgeText: '#60a5fa',
        };
      default:
        return {
          text: 'text-zinc-400',
          badgeText: '#a1a1aa',
        };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'seismic':
        return <Activity className="w-3.5 h-3.5 text-rose-400/70" />;
      case 'solar':
        return <Zap className="w-3.5 h-3.5 text-amber-400/70" />;
      case 'atmospheric':
        return <Wind className="w-3.5 h-3.5 text-sky-400/70" />;
      default:
        return <AlertCircle className="w-3.5 h-3.5 text-zinc-400/70" />;
    }
  };

  const filteredEvents = events.filter(e => activeCategories.has(e.type));

  return (
    <aside 
      id="live-feed-sidebar" 
      className="fixed right-12 top-28 bottom-28 z-30 flex flex-col gap-4 w-80 bg-white/[0.035] backdrop-blur-3xl px-5 py-5 rounded-2xl shadow-2xl shadow-black/40 transition-all duration-500"
    >
      {/* Detailed Event Inspection overlay when selected */}
      <AnimatePresence mode="wait">
        {selectedEvent && (
          <motion.div
            key={`detail-${selectedEvent.id}`}
            initial={{ opacity: 0, height: 0, marginBox: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-white/5 rounded-xl text-left"
          >
            <div className="p-4 flex flex-col">
              <div className="flex justify-between items-center mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-widest text-[#e2e1eb] bg-white/10 uppercase">
                  {selectedEvent.type}
                </span>
                <button 
                  onClick={() => onSelectEvent(null)}
                  className="font-mono text-[9px] tracking-widest uppercase text-zinc-400 hover:text-white cursor-pointer"
                >
                  [CLOSE]
                </button>
              </div>

              <h4 className="text-xs font-semibold tracking-tight text-white mb-1">
                {selectedEvent.title}
              </h4>
              <p className="text-zinc-550 text-zinc-400 text-[10px] mb-2">{selectedEvent.location}</p>

              <div className="grid grid-cols-2 gap-2 mb-2 py-1.5 font-mono text-[8px] text-zinc-400">
                <div>
                  <div className="text-zinc-550">TIMESTAGE</div>
                  <div className="text-zinc-350 font-bold">{selectedEvent.timestamp}</div>
                </div>
                <div>
                  <div className="text-zinc-550">COORDINATES</div>
                  <div className="text-zinc-350 font-bold">
                    {Math.round((selectedEvent.y - 50) * 1.8)}°N, {Math.round((selectedEvent.x - 50) * 3.6)}°E
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-zinc-300 leading-normal font-light max-h-20 overflow-y-auto scrollbar-none antialiased">
                {selectedEvent.description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Feed Header */}
      <div className="flex items-center justify-between pb-2" id="feed-header">
        <span className="font-sans text-[10px] tracking-[0.25em] text-zinc-400/60 uppercase font-semibold">
          LIVE FEED
        </span>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[9px] text-zinc-500 font-medium">STRATUM: {filteredEvents.length}</span>
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
        </div>
      </div>

      {/* Events Container */}
      <div 
        id="events-list-scrollable"
        className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 scrollbar-none pr-1"
        style={{ scrollbarWidth: 'none' }}
      >
        <AnimatePresence initial={false}>
          {filteredEvents.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-48 text-zinc-500 text-[11px] font-mono"
            >
              <Radio className="w-5 h-5 mb-2 animate-pulse text-zinc-600" />
              NO CORE SIGNALS
            </motion.div>
          ) : (
            filteredEvents.map((event) => {
              const isSelected = selectedEvent?.id === event.id;
              const { text: categoryText } = getCategoryColor(event.type);

              return (
                <motion.div
                  key={event.id}
                  id={`feed-item-${event.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className={`group relative p-3 rounded-xl transition-all duration-300 cursor-pointer text-left ${
                    isSelected 
                      ? 'bg-white/[0.06] shadow-lg shadow-black/20' 
                      : 'bg-transparent hover:bg-white/[0.02]'
                  }`}
                  onClick={() => onSelectEvent(event)}
                >
                  {/* Left Accent indicator line */}
                  <div 
                    className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-opacity duration-300 ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
                    }`}
                    style={{ backgroundColor: getCategoryColor(event.type).badgeText }}
                  />

                  {/* Top stamp sequence */}
                  <div className="flex items-center justify-between mb-1 font-mono text-[11px] tabular-nums">
                    <div className="flex items-center gap-2">
                       <span className="text-zinc-550">[{event.originalTime || event.timestamp}]</span>
                      <span className={`font-bold tracking-widest text-[9px] uppercase ${categoryText}`}>
                        {event.type}
                      </span>
                    </div>
                    <div className="text-[9px] text-zinc-600 group-hover:text-zinc-400 transition-colors">
                      {event.minutesAgo === 0 ? 'NOW' : `${event.minutesAgo}M`}
                    </div>
                  </div>

                  {/* Title of event */}
                  <p className="text-zinc-300 text-sm font-light leading-tight font-sans group-hover:text-white transition-colors">
                    {event.title}
                  </p>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Diagnostics / Telemetry sub-panel */}
      <div className="pt-3 font-mono text-[9px] text-zinc-500 space-y-1.5">
        <div className="flex justify-between">
          <span>ATMOSPHERE</span>
          <span className="text-zinc-450">1013 HPA [NORM]</span>
        </div>
        <div className="flex justify-between">
          <span>SOLAR FLUX</span>
          <span className="text-amber-500">12.4 SFU</span>
        </div>
        <div className="flex justify-between">
          <span>CRUSTAL PRESSURE</span>
          <span className="text-rose-400">0.02 μM/S²</span>
        </div>
      </div>
    </aside>
  );
}
