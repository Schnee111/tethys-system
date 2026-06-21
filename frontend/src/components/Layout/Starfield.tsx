export function Starfield() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 bg-[#020208]" />
      <svg className="absolute inset-0 w-full h-full opacity-40" xmlns="http://www.w3.org/2000/svg">
        <g className="animate-twinkle-slow text-zinc-400">
          <circle cx="4%" cy="8%" r="1" fill="currentColor" />
          <circle cx="28%" cy="30%" r="1.5" fill="currentColor" />
          <circle cx="86%" cy="12%" r="1" fill="currentColor" />
          <circle cx="48%" cy="72%" r="1" fill="currentColor" />
          <circle cx="94%" cy="82%" r="1.5" fill="currentColor" className="text-zinc-500" />
        </g>
        <g className="animate-twinkle-mid text-zinc-300">
          <circle cx="16%" cy="17%" r="1.5" fill="currentColor" />
          <circle cx="70%" cy="36%" r="1.2" fill="currentColor" />
          <circle cx="89%" cy="58%" r="1.5" fill="currentColor" />
          <circle cx="55%" cy="5%" r="1.2" fill="currentColor" />
        </g>
        <g className="animate-twinkle-fast text-zinc-200">
          <circle cx="6%" cy="40%" r="1.2" fill="currentColor" />
          <circle cx="32%" cy="52%" r="1.5" fill="currentColor" />
          <circle cx="76%" cy="78%" r="1.5" fill="currentColor" />
        </g>
      </svg>
    </div>
  );
}
