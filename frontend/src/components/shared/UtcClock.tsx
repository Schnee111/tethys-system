import { useState, useEffect } from 'react';

function fmt(utc: boolean) {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
    timeZone: utc ? 'UTC' : undefined,
  });
}

export function UtcClock() {
  const [utc, setUtc] = useState(false);
  const [time, setTime] = useState(() => fmt(false));

  useEffect(() => {
    const id = setInterval(() => setTime(fmt(utc)), 1000);
    return () => clearInterval(id);
  }, [utc]);

  const base: React.CSSProperties = {
    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em',
    color: '#71717a', cursor: 'pointer', transition: 'color 0.15s',
  };

  return (
    <span
      onClick={() => setUtc(!utc)}
      style={base}
      onMouseEnter={e => { e.currentTarget.style.color = '#a1a1aa'; }}
      onMouseLeave={e => { e.currentTarget.style.color = '#71717a'; }}
      title="Click to toggle UTC/Local"
    >
      {time} <span style={{ fontSize: 8, color: '#52525b' }}>{utc ? 'UTC' : 'LOCAL'}</span>
    </span>
  );
}
