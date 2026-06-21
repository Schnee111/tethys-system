import React from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface TimelineSliderProps {
  percent: number; // 0 (12h ago) to 100 (LIVE)
  onChange: (percent: number) => void;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
}

export default function TimelineSlider({
  percent,
  onChange,
  isPlaying,
  setIsPlaying,
}: TimelineSliderProps) {
  // Convert percent to hours/minutes representation for visual labeling
  const getTimelineTimeLabel = () => {
    if (percent === 100) return 'LIVE';
    const hoursAgo = 12 - (percent / 100) * 12;
    if (hoursAgo === 0) return 'LIVE';
    
    const h = Math.floor(hoursAgo);
    const m = Math.round((hoursAgo - h) * 60);
    return `-${h > 0 ? `${h}H` : ''}${m > 0 ? `${m}M` : ''}`;
  };

  return (
    <div 
      id="timeline-controls" 
      className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white/[0.04] backdrop-blur-3xl rounded-full px-6 py-3 shadow-2xl shadow-black/50 w-[460px] max-w-full transition-all duration-300"
    >
      {/* Play / Pause Toggle Button */}
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        id="timeline-playback-btn"
        className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${
          isPlaying 
            ? 'bg-emerald-500/20 text-emerald-300' 
            : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
        }`}
        title={isPlaying ? "Pause Playback" : "Start Playback Loop"}
      >
        {isPlaying ? (
          <Pause className="w-3 h-3 fill-current" />
        ) : (
          <Play className="w-3 h-3 fill-current translate-x-0.5" />
        )}
      </button>

      {/* Reset button */}
      <button
        onClick={() => {
          setIsPlaying(false);
          onChange(100);
        }}
        id="timeline-reset-btn"
        className="w-7 h-7 rounded-full flex items-center justify-center bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-all"
        title="Reset to Current/Live"
      >
        <RotateCcw className="w-3 h-3" />
      </button>

      <span className="w-px h-4 bg-white/5" />

      {/* Scrubber slider timeline */}
      <div className="flex-1 flex items-center gap-3 font-mono text-[11px] font-semibold text-zinc-500" id="slider-track-box">
        <span 
          className="text-[10px] text-zinc-400/50 hover:text-white transition-colors cursor-pointer select-none"
          onClick={() => onChange(0)}
        >
          -12H
        </span>
        
        <div className="relative flex-1 group">
          <input
            type="range"
            min="0"
            max="100"
            value={percent}
            onChange={(e) => {
              setIsPlaying(false);
              onChange(Number(e.target.value));
            }}
            id="timeline-scrub-slider"
            className="w-full h-[2px] bg-white/10 rounded-lg appearance-none cursor-ew-resize accent-white group-hover:bg-white/20 transition-all outline-none"
            style={{
              background: `linear-gradient(to right, rgba(255, 255, 255, 0.4) 0%, rgba(255, 255, 255, 0.4) ${percent}%, rgba(255, 255, 255, 0.08) ${percent}%, rgba(255, 255, 255, 0.08) 100%)`
            }}
          />
        </div>

        <span 
          onClick={() => onChange(100)}
          className={`text-[10px] tracking-widest uppercase transition-colors cursor-pointer select-none ${
            percent === 100 ? 'text-primary' : 'text-zinc-400/50 hover:text-white'
          }`}
        >
          {getTimelineTimeLabel()}
        </span>
      </div>
    </div>
  );
}
