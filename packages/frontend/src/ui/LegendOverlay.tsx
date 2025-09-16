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
  const row = (label: string, cmd: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
      <span>{label}</span>
      <kbd style={kbdStyle}>{cmd}</kbd>
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
          {row('World Map', 'M')}
          {row('Toggle Minimap', 'N')}
          {row('Pan View', 'Shift + Arrows')}
          {row('Fast Travel to Nearest House', 'F')}
          {row('Toggle High Contrast', 'H')}
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
