import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  summary?: string; // Shown when collapsed
  children: ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = true, summary, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden' }}>
      {/* Header — always visible, clickable */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.03)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {open
            ? <ChevronDown style={{ width: 12, height: 12, color: '#71717a' }} />
            : <ChevronRight style={{ width: 12, height: 12, color: '#71717a' }} />
          }
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.1em',
            color: '#a1a1aa',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            {title}
          </span>
        </div>
        {!open && summary && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#52525b' }}>
            {summary}
          </span>
        )}
      </div>

      {/* Content — collapsible */}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0 0 0' }}>
          {children}
        </div>
      )}
    </div>
  );
}
