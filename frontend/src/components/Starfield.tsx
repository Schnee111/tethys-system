export function Starfield() {
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 0.9, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.4,
        backgroundImage: 'radial-gradient(1px 1px at 20px 30px, #fff, transparent), radial-gradient(1.5px 1.5px at 150px 60px, #fff, transparent), radial-gradient(1px 1px at 300px 120px, #fff, transparent)',
        backgroundSize: '400px 400px',
      }} />
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.3,
        backgroundImage: 'radial-gradient(1px 1px at 80px 100px, #fff, transparent), radial-gradient(1.5px 1.5px at 250px 180px, #fff, transparent)',
        backgroundSize: '500px 500px',
      }} />
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
        <g className="animate-twinkle-slow" style={{ color: '#a1a1aa' }}>
          <circle cx="4%" cy="8%" r="1" fill="currentColor" />
          <circle cx="28%" cy="30%" r="1.5" fill="currentColor" />
          <circle cx="86%" cy="12%" r="1" fill="currentColor" />
          <circle cx="48%" cy="72%" r="1" fill="currentColor" />
          <circle cx="94%" cy="82%" r="1.5" fill="currentColor" style={{ color: '#71717a' }} />
        </g>
        <g className="animate-twinkle-mid" style={{ color: '#d4d4d8' }}>
          <circle cx="16%" cy="17%" r="1.5" fill="currentColor" />
          <circle cx="41%" cy="20%" r="2" fill="currentColor" style={{ color: 'rgba(254,243,199,0.8)' }} />
          <circle cx="70%" cy="36%" r="1.2" fill="currentColor" />
          <circle cx="89%" cy="58%" r="1.5" fill="currentColor" style={{ color: 'rgba(186,230,253,0.7)' }} />
        </g>
        <g className="animate-twinkle-fast" style={{ color: '#e4e4e7' }}>
          <circle cx="6%" cy="40%" r="1.2" fill="currentColor" />
          <circle cx="32%" cy="52%" r="1.5" fill="currentColor" />
          <circle cx="76%" cy="78%" r="1.5" fill="currentColor" style={{ color: 'rgba(165,243,252,0.9)' }} />
        </g>
      </svg>
    </div>
  );
}
