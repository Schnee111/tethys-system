import { useState, useEffect } from 'react';

export function UtcClock() {
  const [useUtc, setUseUtc] = useState(false);
  const [time, setTime] = useState(() => getTime(false));

  function getTime(utc: boolean) {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: utc ? 'UTC' : undefined,
    });
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTime(useUtc));
    }, 1000);
    return () => clearInterval(interval);
  }, [useUtc]);

  return (
    <span
      onClick={() => setUseUtc(!useUtc)}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.05em',
        color: '#71717a',
        cursor: 'pointer',
        transition: 'color 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#71717a'; }}
      title="Click to toggle UTC/Local"
    >
      {time} <span style={{ fontSize: 8, color: '#52525b' }}>{useUtc ? 'UTC' : 'LOCAL'}</span>
    </span>
  );
}
