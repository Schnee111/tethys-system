import { Activity, Zap, Wind } from 'lucide-react';

interface CategoryFilterProps {
  activeCategories: Set<string>;
  onToggle: (category: string) => void;
}

export function CategoryFilter({ activeCategories, onToggle }: CategoryFilterProps) {
  const categories = [
    { key: 'seismic', label: 'Seismic', icon: Activity, color: '#f87171' },
    { key: 'solar', label: 'Solar', icon: Zap, color: '#fbbf24' },
    { key: 'atmospheric', label: 'Atmospheric', icon: Wind, color: '#60a5fa' },
  ];

  return (
    <nav style={{
      position: 'fixed',
      bottom: 48,
      left: 48,
      zIndex: 40,
      background: 'rgba(255,255,255,0.15)',
      backdropFilter: 'blur(16px)',
      borderRadius: 9999,
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 32,
      boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
      userSelect: 'none',
    }}>
      {categories.map((cat) => {
        const isActive = activeCategories.has(cat.key);
        const Icon = cat.icon;
        return (
          <button
            key={cat.key}
            onClick={() => onToggle(cat.key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              opacity: isActive ? 1 : 0.35,
              transform: isActive ? 'scale(1.05)' : 'scale(1)',
              transition: 'all 0.3s',
            }}
          >
            <Icon style={{ width: 16, height: 16, color: isActive ? cat.color : '#71717a' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: '#d4d4d8', textTransform: 'uppercase', fontWeight: 700 }}>
              {cat.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
