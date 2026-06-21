import { useDataStore } from '../stores/dataStore';

const SEVERITY_COLORS: Record<string, string> = {
  low: '#3b82f6',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#dc2626',
};

export function AnomalyPanel() {
  const { anomalies, isLoading } = useDataStore();

  return (
    <div className="p-3.5 rounded-2xl bg-white/[0.035] backdrop-blur-3xl text-left font-sans shadow-2xl shadow-black/40 flex-1 min-h-0">
      <div className="flex justify-between items-center mb-3">
        <span className="font-sans text-[9px] text-zinc-400/50 uppercase tracking-wider font-semibold">
          ANOMALIES ({anomalies.length})
        </span>
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse" />
      </div>
      <div className="space-y-2 overflow-y-auto scrollbar-none max-h-64" style={{ scrollbarWidth: 'none' }}>
        {isLoading ? (
          <div className="text-[10px] text-zinc-500 font-mono">Loading...</div>
        ) : anomalies.length === 0 ? (
          <div className="text-[10px] text-zinc-500 font-mono">No anomalies detected</div>
        ) : (
          anomalies.slice(0, 15).map((a) => (
            <div key={a.anomaly_id} className="flex items-start gap-2 py-1.5">
              <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: SEVERITY_COLORS[a.severity] || '#64748b' }} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[9px] text-zinc-400/70 uppercase tracking-wider">{a.domain}</span>
                  <span className="font-mono text-[9px] text-zinc-500">z={a.z_score?.toFixed(1)}</span>
                </div>
                <p className="text-[10px] text-zinc-300 font-sans truncate">{a.description}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
