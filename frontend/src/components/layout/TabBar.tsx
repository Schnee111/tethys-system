import { Activity, Database, Radio } from 'lucide-react';

export type TabKey = 'live' | 'intelligence' | 'data';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ width?: number; height?: number; color?: string }>;
  badge?: number;
}

export function TabBar({
  active,
  onChange,
  anomalyCount,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
  anomalyCount: number;
}) {
  const tabs: TabDef[] = [
    { key: 'live', label: 'LIVE', icon: Radio },
    { key: 'intelligence', label: 'INTELLIGENCE', icon: Activity, badge: anomalyCount },
    { key: 'data', label: 'DATA', icon: Database },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: 3,
        borderRadius: 12,
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {tabs.map(t => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '6px 16px',
              borderRadius: 9,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: isActive ? '#fff' : '#a1a1aa',
              background: isActive
                ? 'linear-gradient(rgba(255,255,255,0.12), rgba(255,255,255,0.12))'
                : 'transparent',
              boxShadow: isActive ? '0 0 20px rgba(56,189,248,0.15), inset 0 0 0 1px rgba(255,255,255,0.08)' : 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
          >
            <Icon width={13} height={13} color={isActive ? '#38bdf8' : '#71717a'} />
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span
                style={{
                  minWidth: 16,
                  height: 16,
                  padding: '0 5px',
                  borderRadius: 8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  background: isActive ? 'rgba(251,191,36,0.2)' : 'rgba(251,191,36,0.12)',
                  color: '#fbbf24',
                }}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
