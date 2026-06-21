import { useDataStore } from '../../stores/dataStore';

export function ActivityCard() {
  const { activity } = useDataStore();

  const level = activity?.activity_level || 'unknown';
  const score = activity?.activity_score ?? 0;
  const confidence = activity?.confidence ?? 0;

  return (
    <div className="bg-white/[0.03] backdrop-blur-xl rounded-xl p-4 border border-white/[0.05]">
      <span className="text-[10px] tracking-[0.25em] text-zinc-400/60 uppercase font-semibold">
        ACTIVITY INDEX
      </span>
      <div className="mt-2">
        <span
          className="text-2xl font-bold uppercase"
          style={{ color: getLevelColor(level) }}
        >
          {level}
        </span>
      </div>
      <div className="mt-1 font-mono text-[11px] text-zinc-500">
        Score: {score.toFixed(2)} / 1.00 · Confidence: {(confidence * 100).toFixed(0)}%
      </div>
      <div className="mt-3 h-1 bg-white/[0.05] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${score * 100}%`,
            background: `linear-gradient(90deg, ${getLevelColor(level)}, ${getLevelColor(level)}88)`,
          }}
        />
      </div>
    </div>
  );
}

function getLevelColor(level: string): string {
  const colors: Record<string, string> = {
    nominal: '#22c55e',
    elevated: '#f59e0b',
    high: '#ef4444',
    intense: '#dc2626',
  };
  return colors[level] || '#64748b';
}
