export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white/[0.03] backdrop-blur-xl border-b border-white/[0.05] z-20 relative">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold tracking-[0.15em] text-white uppercase">
          TETHYS
        </h1>
        <span className="text-[11px] text-zinc-500 font-mono">Planetary Intelligence System</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[11px] text-zinc-500 font-mono">v0.1.0</span>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-mono font-semibold tracking-widest text-emerald-400 uppercase">
            LIVE
          </span>
        </div>
      </div>
    </header>
  );
}
