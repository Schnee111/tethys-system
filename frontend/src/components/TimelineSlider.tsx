import { useGlobeStore } from '../stores/globeStore';
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
    <div style={{
      position: 'fixed',
      bottom: 48,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      background: 'rgba(255,255,255,0.08)',
      backdropFilter: 'blur(16px)',
      borderRadius: 9999,
      padding: '12px 24px',
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
      width: 460,
      maxWidth: '100%',
    }}>
      {/* Play/Pause */}
      <button
        onClick={() => setLive(!isLive)}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: 'none',
          background: isLive ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)',
          color: isLive ? '#6ee7b7' : '#a1a1aa',
          transition: 'all 0.3s',
        }}
      >
        {isLive ? <Pause style={{ width: 12, height: 12 }} /> : <Play style={{ width: 12, height: 12 }} />}
      </button>

      {/* Reset */}
      <button
        onClick={() => { setLive(true); setTimelinePercent(100); }}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.08)',
          color: '#a1a1aa',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <RotateCcw style={{ width: 12, height: 12 }} />
      </button>

      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)' }} />

      {/* Slider */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: '#71717a' }}>
        <span style={{ fontSize: 10, color: 'rgba(161,161,170,0.5)', cursor: 'pointer' }} onClick={() => setTimelinePercent(0)}>
          -12H
        </span>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="range"
            min={0}
            max={100}
            value={timelinePercent}
            onChange={(e) => { setLive(false); setTimelinePercent(Number(e.target.value)); }}
            style={{
              width: '100%',
              height: 2,
              background: `linear-gradient(to right, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.08) ${timelinePercent}%, rgba(255,255,255,0.08) ${timelinePercent}%, rgba(255,255,255,0.08) 100%)`,
              borderRadius: 1,
              cursor: 'ew-resize',
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          />
        </div>
        <span
          onClick={() => { setLive(true); setTimelinePercent(100); }}
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            color: timelinePercent === 100 ? '#4ade80' : 'rgba(161,161,170,0.5)',
          }}
        >
          {getTimeLabel()}
        </span>
      </div>
    </div>
  );
}
