import { useRef, useCallback, useEffect, useState } from 'react';
import { useGlobeStore } from '../stores/globeStore';
import { Play, Pause, RotateCcw } from 'lucide-react';

export function TimelineSlider() {
  const { timelinePercent, setTimelinePercent, isLive, setLive } = useGlobeStore();
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const getTimeLabel = () => {
    if (timelinePercent === 100) return 'LIVE';
    const hoursAgo = 12 - (timelinePercent / 100) * 12;
    if (hoursAgo === 0) return 'LIVE';
    const h = Math.floor(hoursAgo);
    const m = Math.round((hoursAgo - h) * 60);
    return `-${h > 0 ? `${h}H` : ''}${m > 0 ? `${m}M` : ''}`;
  };

  const getPercentFromX = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = clientX - rect.left;
    return Math.round(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    setLive(false);
    setTimelinePercent(getPercentFromX(e.clientX));
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [getPercentFromX, setTimelinePercent, setLive]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setTimelinePercent(getPercentFromX(e.clientX));
  }, [dragging, getPercentFromX, setTimelinePercent]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Keyboard support
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { setLive(false); setTimelinePercent(Math.max(0, timelinePercent - 1)); }
      if (e.key === 'ArrowRight') { setLive(false); setTimelinePercent(Math.min(100, timelinePercent + 1)); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [timelinePercent, setTimelinePercent, setLive]);

  const fillWidth = `${timelinePercent}%`;

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
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)',
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
          background: isLive ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
          color: isLive ? '#6ee7b7' : '#a1a1aa',
          transition: 'all 0.3s',
        }}
      >
        {isLive ? <Pause style={{ width: 12, height: 12 }} /> : <Play style={{ width: 12, height: 12, marginLeft: 1 }} />}
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
          background: 'rgba(255,255,255,0.05)',
          color: '#a1a1aa',
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <RotateCcw style={{ width: 12, height: 12 }} />
      </button>

      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)' }} />

      {/* Slider */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: '#71717a' }}>
        <span
          style={{ fontSize: 10, color: 'rgba(161,161,170,0.5)', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => { setLive(false); setTimelinePercent(0); }}
        >
          -12H
        </span>

        {/* Custom track */}
        <div
          ref={trackRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            flex: 1,
            height: 10,
            display: 'flex',
            alignItems: 'center',
            cursor: 'ew-resize',
            touchAction: 'none',
            position: 'relative',
          }}
        >
          {/* Track background */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 2,
            borderRadius: 1,
            background: 'rgba(255,255,255,0.08)',
          }} />
          {/* Track fill */}
          <div style={{
            position: 'absolute',
            left: 0,
            width: fillWidth,
            height: 2,
            borderRadius: 1,
            background: 'rgba(255,255,255,0.4)',
          }} />
          {/* Thumb */}
          <div style={{
            position: 'absolute',
            left: fillWidth,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#fff',
            transform: 'translate(-50%, 0)',
            boxShadow: '0 0 6px rgba(255,255,255,0.3)',
            transition: dragging ? 'none' : 'left 0.1s ease-out',
          }} />
        </div>

        <span
          onClick={() => { setLive(true); setTimelinePercent(100); }}
          style={{
            fontSize: 10,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            userSelect: 'none',
            color: timelinePercent === 100 ? '#4ade80' : 'rgba(161,161,170,0.5)',
            transition: 'color 0.2s',
          }}
        >
          {getTimeLabel()}
        </span>
      </div>
    </div>
  );
}
