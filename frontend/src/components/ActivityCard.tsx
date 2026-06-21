import { useDataStore } from '../stores/dataStore';

export function ActivityCard() {
  const { activity, isLoading } = useDataStore();
  const level = activity?.activity_level || 'unknown';
  const score = activity?.activity_score ?? 0;
  const confidence = activity?.confidence ?? 0;

  return (
    <div className="p-3.5 rounded-2xl bg-white/[0.035] backdrop-blur-3xl text-left font-sans text-[10px] text-zinc-500 space-y-1.5 shadow-2xl shadow-black/40 shrink-0">
      <div className="flex justify-between items-center">
        <span className="font-sans text-[9px] text-zinc-400/50 uppercase tracking-wider font-semibold">ACTIVITY INDEX</span>
        <span className="text-emerald-400/80 font-bold font-mono text-[9px]">{isLoading ? '...' : level.toUpperCase()}</span>
      </div>
      <div className="flex justify-between font-mono text-[9px]">
        <span>SCORE</span>
        <span className="text-zinc-300 font-bold">{score.toFixed(2)} / 1.00</span>
      </div>
      <div className="flex justify-between font-mono text-[9px]">
        <span>CONFIDENCE</span>
        <span className="text-zinc-300 font-bold">{(confidence * 100).toFixed(0)}%</span>
      </div>
      <div className="flex justify-between font-mono text-[9px]">
        <span>ANOMALIES</span>
        <span className="text-zinc-300 font-bold">{activity?.active_anomalies ?? 0}</span>
      </div>
    </div>
  );
}
