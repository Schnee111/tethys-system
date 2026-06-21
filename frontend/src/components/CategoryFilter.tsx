import { Activity, Zap, Wind } from 'lucide-react';

interface CategoryFilterProps {
  activeCategories: Set<string>;
  onToggle: (category: string) => void;
}

export function CategoryFilter({ activeCategories, onToggle }: CategoryFilterProps) {
  const categories = [
    { key: 'seismic', label: 'Seismic', icon: Activity, color: 'text-rose-400' },
    { key: 'solar', label: 'Solar', icon: Zap, color: 'text-amber-400' },
    { key: 'atmospheric', label: 'Atmospheric', icon: Wind, color: 'text-sky-400' },
  ];

  return (
    <nav className="fixed bottom-12 left-12 z-40 bg-white/[0.04] backdrop-blur-3xl rounded-full px-6 py-3 flex items-center gap-8 shadow-2xl shadow-black/50 select-none">
      {categories.map((cat) => {
        const isActive = activeCategories.has(cat.key);
        const Icon = cat.icon;
        return (
          <button
            key={cat.key}
            onClick={() => onToggle(cat.key)}
            className={`flex flex-col items-center gap-1 group cursor-pointer transition-all duration-300 ${
              isActive ? 'opacity-100 scale-105' : 'opacity-35 hover:opacity-75'
            }`}
          >
            <Icon
              className={`w-4 h-4 group-hover:scale-110 transition-transform ${
                isActive ? cat.color : 'text-zinc-400'
              }`}
            />
            <span className="font-mono text-[9px] tracking-widest text-zinc-300 uppercase font-bold">
              {cat.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
