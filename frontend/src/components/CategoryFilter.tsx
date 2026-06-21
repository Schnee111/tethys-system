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
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 40,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      paddingBottom: 12,
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
