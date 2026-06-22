import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  summary?: string;
  children: ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = true, summary, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      {/* Header — clickable */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '6px 0',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7'; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {open
            ? <ChevronDown style={{ width: 11, height: 11, color: '#52525b' }} />
            : <ChevronRight style={{ width: 11, height: 11, color: '#52525b' }} />
          }
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.1em',
            color: '#71717a',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}>
            {title}
          </span>
        </div>
        {!open && summary && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#3f3f46' }}>
            {summary}
          </span>
        )}
      </button>

      {/* Content */}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
}
