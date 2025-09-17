import React, { useEffect, useState } from 'react';

const KEY = 'help_hint_seen_v1';

export function HelpHint({ onOpen }: { onOpen: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem(KEY);
      if (!seen) {
        setVisible(true);
        const t = window.setTimeout(() => setVisible(false), 6000);
        return () => window.clearTimeout(t);
      }
    } catch (e) {
      void e;
    }
  }, []);
  if (!visible) return null;
  return (
    <button
      onClick={() => {
        try {
          localStorage.setItem(KEY, '1');
        } catch (e) {
          void e;
        }
        setVisible(false);
        onOpen();
      }}
      aria-label="Open help legend"
      style={{
        position: 'absolute',
        right: 12,
        top: 92,
        background: '#0b1220',
        color: '#e5e7eb',
        border: '1px solid #334155',
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 12,
        cursor: 'pointer',
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        opacity: 0.95,
      }}
    >
      Help (?)
    </button>
  );
}
