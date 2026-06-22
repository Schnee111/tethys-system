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
      display: 'flex',
      alignItems: 'center',
      gap: 4,
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
              gap: 6,
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${isActive ? cat.color : 'transparent'}`,
              cursor: 'pointer',
              padding: '6px 10px',
              transition: 'all 0.15s',
            }}
          >
            <Icon style={{ width: 12, height: 12, color: isActive ? cat.color : '#52525b' }} />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.1em',
              color: isActive ? '#e4e4e7' : '#52525b',
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
