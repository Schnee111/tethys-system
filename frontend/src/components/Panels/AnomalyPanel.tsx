import { useDataStore } from '../../stores/dataStore';

export function AnomalyPanel() {
  const { anomalies, isLoading } = useDataStore();

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between pb-2">
        <span className="text-[10px] tracking-[0.25em] text-zinc-400/60 uppercase font-semibold">
          ANOMALIES ({anomalies.length})
        </span>
      </div>
      <div className="space-y-2 overflow-y-auto scrollbar-none max-h-64">
        {isLoading ? (
          <div className="text-[11px] text-zinc-500 p-3">Loading anomalies...</div>
        ) : anomalies.length === 0 ? (
          <div className="text-[11px] text-zinc-500 p-3">No anomalies detected</div>
        ) : (
          anomalies.slice(0, 20).map((a) => (
            <div
              key={a.anomaly_id}
              className="p-3 rounded-lg bg-white/[0.02] border-l-2 hover:bg-white/[0.04] transition-colors cursor-pointer"
              style={{ borderLeftColor: getSeverityColor(a.severity) }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-zinc-400">
                  {a.domain}
                </span>
                <span className="text-[9px] font-mono text-zinc-500">
                  z={a.z_score?.toFixed(1)}
                </span>
              </div>
              <p className="text-[12px] text-zinc-300">{a.description}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    low: '#3b82f6',
    medium: '#f59e0b',
    high: '#ef4444',
    critical: '#dc2626',
  };
  return colors[severity] || '#64748b';
}
