import React from 'react';

const logHelpMenuWarning = (context: string, error: unknown) => {
  if (import.meta.env?.DEV && typeof console !== 'undefined') {
    console.warn(`[HelpMenu] ${context}`, error);
  }
};

export function HelpMenu({
  onOpenFeedback,
  onOpenLegend,
}: {
  onOpenFeedback: () => void;
  onOpenLegend?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const [hintSeen, setHintSeen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    try {
      setHintSeen(!!localStorage.getItem('help_hint_seen_v1'));
    } catch (error) {
      logHelpMenuWarning('reading hint flag', error);
    }
    function onDoc(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(t) &&
        btnRef.current &&
        !btnRef.current.contains(t)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div style={{ position: 'absolute', right: 12, top: 56 }}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          padding: '8px 12px',
          background: '#0b1220',
          color: '#e5e7eb',
          border: '1px solid #334155',
          borderRadius: 8,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>Help</span>
        {hintSeen && (
          <span
            aria-hidden
            style={{
              opacity: hover ? 1 : 0,
              transition: 'opacity 150ms ease',
              background: '#111827',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: 8,
              fontSize: 10,
              padding: '2px 6px',
            }}
          >
            ?
          </span>
        )}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Help menu"
          style={{
            marginTop: 8,
            position: 'absolute',
            right: 0,
            background: '#0b1220',
            color: '#e5e7eb',
            border: '1px solid #334155',
            borderRadius: 8,
            minWidth: 220,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 3000,
          }}
        >
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenLegend?.();
            }}
            style={{ ...itemStyle, width: '100%', textAlign: 'left', background: 'transparent' }}
          >
            Keyboard Legend (?)
          </button>
          <a
            role="menuitem"
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            style={itemStyle}
          >
            Documentation
          </a>
          <a
            role="menuitem"
            href="https://discord.gg/"
            target="_blank"
            rel="noopener noreferrer"
            style={itemStyle}
          >
            Discord
          </a>
          <a
            role="menuitem"
            href="https://github.com/orgs/ai-agent-village/discussions"
            target="_blank"
            rel="noopener noreferrer"
            style={itemStyle}
          >
            GitHub Discussions
          </a>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenFeedback();
            }}
            style={{ ...itemStyle, width: '100%', textAlign: 'left', background: 'transparent' }}
          >
            Submit Feedback
          </button>
        </div>
      )}
    </div>
  );
}

const itemStyle: React.CSSProperties = {
  display: 'block',
  padding: '8px 12px',
  textDecoration: 'none',
  color: '#e5e7eb',
  borderBottom: '1px solid #1f2937',
};
