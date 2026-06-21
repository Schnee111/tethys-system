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
      background: 'rgba(255,255,255,0.06)',
      backdropFilter: 'blur(16px)',
      borderRadius: 9999,
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 24,
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
              alignItems: 'center',
              gap: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              opacity: isActive ? 1 : 0.3,
              transition: 'opacity 0.2s',
              padding: 0,
            }}
          >
            <Icon style={{ width: 14, height: 14, color: isActive ? cat.color : '#52525b' }} />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.1em',
              color: isActive ? '#e4e4e7' : '#71717a',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}>
              {cat.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
