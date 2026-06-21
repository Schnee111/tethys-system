export function Starfield() {
  return (
    <div className="absolute inset-0 opacity-90 pointer-events-none">
      <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_20px_30px,#fff,transparent),radial-gradient(1.5px_1.5px_at_150px_60px,#fff,transparent),radial-gradient(1px_1px_at_300px_120px,#fff,transparent),radial-gradient(2px_2px_at_450px_400px,rgba(255,255,255,0.7),transparent),radial-gradient(1px_1px_at_200px_280px,#fff,transparent)] bg-[size:400px_400px] opacity-40"></div>
      <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_80px_100px,#fff,transparent),radial-gradient(1.5px_1.5px_at_250px_180px,#fff,transparent),radial-gradient(2px_2px_at_500px_250px,rgba(255,255,255,0.8),transparent),radial-gradient(1px_1px_at_350px_450px,#fff,transparent)] bg-[size:500px_500px] opacity-30 bg-center"></div>
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <g className="animate-twinkle-slow text-zinc-400">
          <circle cx="4%" cy="8%" r="1" fill="currentColor" />
          <circle cx="28%" cy="30%" r="1.5" fill="currentColor" />
          <circle cx="86%" cy="12%" r="1" fill="currentColor" />
          <circle cx="48%" cy="72%" r="1" fill="currentColor" />
          <circle cx="94%" cy="82%" r="1.5" fill="currentColor" className="text-zinc-500" />
          <circle cx="12%" cy="60%" r="1" fill="currentColor" />
          <circle cx="40%" cy="15%" r="1.2" fill="currentColor" />
          <circle cx="75%" cy="88%" r="1" fill="currentColor" />
        </g>
        <g className="animate-twinkle-mid text-zinc-300">
          <circle cx="16%" cy="17%" r="1.5" fill="currentColor" />
          <circle cx="41%" cy="20%" r="2" fill="currentColor" className="text-amber-100/80" />
          <circle cx="70%" cy="36%" r="1.2" fill="currentColor" />
          <circle cx="89%" cy="58%" r="1.5" fill="currentColor" className="text-sky-300/70" />
          <circle cx="10%" cy="85%" r="1" fill="currentColor" />
          <circle cx="64%" cy="84%" r="1.8" fill="currentColor" />
          <circle cx="55%" cy="5%" r="1.2" fill="currentColor" />
          <circle cx="93%" cy="30%" r="1.5" fill="currentColor" />
        </g>
        <g className="animate-twinkle-fast text-zinc-200">
          <circle cx="6%" cy="40%" r="1.2" fill="currentColor" />
          <circle cx="32%" cy="52%" r="1.5" fill="currentColor" />
          <circle cx="66%" cy="10%" r="1" fill="currentColor" />
          <circle cx="76%" cy="78%" r="1.5" fill="currentColor" className="text-cyan-200/90" />
          <circle cx="51%" cy="45%" r="1.2" fill="currentColor" />
          <circle cx="82%" cy="48%" r="1" fill="currentColor" />
          <circle cx="22%" cy="88%" r="1.2" fill="currentColor" />
        </g>
      </svg>
    </div>
  );
}
