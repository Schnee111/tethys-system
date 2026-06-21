import { useGlobeStore } from '../../stores/globeStore';
import { Play, Pause, RotateCcw } from 'lucide-react';

export function TimelineSlider() {
  const { timelinePercent, setTimelinePercent, isLive, setLive } = useGlobeStore();

  const getTimeLabel = () => {
    if (timelinePercent === 100) return 'LIVE';
    const hoursAgo = 12 - (timelinePercent / 100) * 12;
    if (hoursAgo === 0) return 'LIVE';
    const h = Math.floor(hoursAgo);
    const m = Math.round((hoursAgo - h) * 60);
    return `-${h > 0 ? `${h}H` : ''}${m > 0 ? `${m}M` : ''}`;
  };

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white/[0.04] backdrop-blur-3xl rounded-full px-6 py-3 shadow-2xl shadow-black/50 w-[460px] max-w-full transition-all duration-300">
      {/* Play/Pause */}
      <button
        onClick={() => setLive(!isLive)}
        className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${
          isLive
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10'
        }`}
      >
        {isLive ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current translate-x-0.5" />}
      </button>

      {/* Reset */}
      <button
        onClick={() => { setLive(true); setTimelinePercent(100); }}
        className="w-7 h-7 rounded-full flex items-center justify-center bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-all"
      >
        <RotateCcw className="w-3 h-3" />
      </button>

      <span className="w-px h-4 bg-white/5" />

      {/* Slider */}
      <div className="flex-1 flex items-center gap-3 font-mono text-[11px] font-semibold text-zinc-500">
        <span
          className="text-[10px] text-zinc-400/50 hover:text-white transition-colors cursor-pointer select-none"
          onClick={() => setTimelinePercent(0)}
        >
          -12H
        </span>

        <div className="relative flex-1 group">
          <input
            type="range"
            min={0}
            max={100}
            value={timelinePercent}
            onChange={(e) => {
              setLive(false);
              setTimelinePercent(Number(e.target.value));
            }}
            className="w-full h-[2px] bg-white/10 rounded-lg appearance-none cursor-ew-resize accent-white group-hover:bg-white/20 transition-all outline-none"
            style={{
              background: `linear-gradient(to right, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.4) ${timelinePercent}%, rgba(255,255,255,0.08) ${timelinePercent}%, rgba(255,255,255,0.08) 100%)`,
            }}
          />
        </div>

        <span
          onClick={() => { setLive(true); setTimelinePercent(100); }}
          className={`text-[10px] tracking-widest uppercase transition-colors cursor-pointer select-none ${
            timelinePercent === 100 ? 'text-emerald-400' : 'text-zinc-400/50 hover:text-white'
          }`}
        >
          {getTimeLabel()}
        </span>
      </div>
    </div>
  );
}
