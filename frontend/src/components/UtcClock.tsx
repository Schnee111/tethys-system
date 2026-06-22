import { useState, useEffect } from 'react';

export function UtcClock() {
  const [time, setTime] = useState(() => new Date().toISOString().slice(11, 19));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toISOString().slice(11, 19));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.05em',
      color: '#71717a',
    }}>
      {time} <span style={{ fontSize: 8, color: '#52525b' }}>UTC</span>
    </span>
  );
}
