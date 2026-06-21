import { useGlobeStore } from '../../stores/globeStore';

export function TimelineSlider() {
  const { timelinePercent, setTimelinePercent, isLive, setLive } = useGlobeStore();

  return (
    <div className="flex items-center gap-4 px-6 py-3 bg-white/[0.02] z-20 relative">
      <span className="font-mono text-[10px] text-zinc-500 min-w-[60px]">Jun 14</span>

      <div className="flex-1 relative">
        <input
          type="range"
          min={0}
          max={100}
          value={timelinePercent}
          onChange={(e) => {
            setLive(false);
            setTimelinePercent(Number(e.target.value));
          }}
          className="w-full h-[2px] bg-white/10 rounded-lg appearance-none cursor-ew-resize outline-none"
          style={{
            background: `linear-gradient(to right, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.4) ${timelinePercent}%, rgba(255,255,255,0.08) ${timelinePercent}%, rgba(255,255,255,0.08) 100%)`,
          }}
        />
      </div>

      <span className="font-mono text-[10px] text-zinc-500 min-w-[60px] text-right">Jun 21</span>

      <button
        onClick={() => {
          setLive(true);
          setTimelinePercent(100);
        }}
        className={`font-mono text-[10px] tracking-widest uppercase px-3 py-1 rounded-full transition-colors cursor-pointer ${
          isLive
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-white/5 text-zinc-500 hover:text-white'
        }`}
      >
        LIVE
      </button>
    </div>
  );
}
