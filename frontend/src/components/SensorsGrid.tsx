import { useDataStore } from '../stores/dataStore';

export function SensorsGrid() {
  const { status } = useDataStore();

  const collectors = status?.collectors || {};
  const sources = [
    { key: 'seismic', label: 'SEISMIC', color: '#f87171' },
    { key: 'solar_wind', label: 'SOLAR WIND', color: '#fbbf24' },
    { key: 'goes_flux', label: 'GOES', color: '#a78bfa' },
    { key: 'donki', label: 'DONKI', color: '#34d399' },
    { key: 'atmospheric', label: 'ATMOSPHERIC', color: '#60a5fa' },
    { key: 'volcanic', label: 'VOLCANIC', color: '#fb923c' },
  ];

  return (
    <div className="p-3.5 rounded-2xl bg-white/[0.035] backdrop-blur-3xl text-left font-sans text-[10px] text-zinc-500 space-y-2 shadow-2xl shadow-black/40 shrink-0">
      <div className="flex justify-between items-center">
        <span className="font-sans text-[9px] text-zinc-400/50 uppercase tracking-wider font-semibold">
          DATA SOURCES
        </span>
        <span className="text-emerald-400/80 font-bold font-mono text-[9px]">
          {Object.values(collectors).filter((c: any) => c.status === 'ok').length}/{sources.length} ACTIVE
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {sources.map((s) => {
          const c = collectors[s.key];
          const isOk = c?.status === 'ok';
          return (
            <div key={s.key} className="flex items-center gap-1.5">
              <div
                className="w-1 h-1 rounded-full"
                style={{ backgroundColor: isOk ? '#22c55e' : '#ef4444' }}
              />
              <span className="font-mono text-[8px] text-zinc-400/70 uppercase tracking-wider">
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
