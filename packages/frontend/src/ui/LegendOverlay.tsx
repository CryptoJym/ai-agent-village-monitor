import React, { useEffect } from 'react';

export function LegendOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const row = (label: string, cmd: string, description?: string) => (
    <div
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <span>{label}</span>
        {description ? <span style={{ fontSize: 11, color: '#cbd5e1' }}>{description}</span> : null}
      </div>
      <kbd style={kbdStyle}>{cmd}</kbd>
    </div>
  );
  const themeItem = (label: string, color: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          display: 'inline-block',
          width: 12,
          height: 12,
          borderRadius: 999,
          background: color,
        }}
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard and Navigation Legend"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 70 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 420,
          maxWidth: '92vw',
          background: '#0b1220',
          border: '1px solid #334155',
          borderRadius: 12,
          padding: 16,
          color: '#e5e7eb',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Legend</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {row('Open Dialogue', 'T')}
          {row('Switch Tabs', '1 / 2 / 3')}
          {row('Close Panel', 'Esc')}
          {row('World Map', 'M', 'Double-click a house to enter its interior')}
          {row('Toggle Village Minimap', 'N')}
          {row('Interior Minimap', 'M', 'Inside houses – shows NPCs and exits')}
          {row('Pan View', 'Shift + Arrows')}
          {row('Fast Travel to Nearest House', 'F')}
          {row('Toggle High Contrast', 'H')}
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid #1f2937', margin: '12px 0' }} />
        <div style={{ display: 'grid', gap: 6 }}>
          <strong>Interior Legend</strong>
          <div style={{ fontSize: 11, color: '#cbd5e1' }}>
            Shapes and colors reflect house themes and interactive elements.
          </div>
          {themeItem('JavaScript Neon Lab', '#1b1f4b')}
          {themeItem('TypeScript Observatory', '#14253b')}
          {themeItem('Python Archive', '#1b3a24')}
          {themeItem('Go Coastal Lodge', '#0f2f40')}
          {themeItem('Ruby Atelier', '#3a0f1f')}
          {themeItem('Java Sky Loft', '#2e1c3b')}
          {themeItem('C# Conservatory', '#1e2f45')}
          {themeItem('Commons Guild Hall', '#1c1c2b')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: 999,
                background: '#fbbf24',
              }}
              aria-hidden
            />
            <span>Doorway / Exit</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: 999,
                background: '#f97316',
              }}
              aria-hidden
            />
            <span>NPC (wanderer)</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              background: '#1f2937',
              color: '#e5e7eb',
              border: '1px solid #374151',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  background: '#111827',
  padding: '2px 6px',
  borderRadius: 6,
  border: '1px solid #374151',
};
