import React from 'react';
export function EngineBadge() {
  let version = 'unknown';
  try {
    const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
    if (!isJsdom) {
      const ph = require('phaser');
      version = (ph as any)?.VERSION ?? 'unknown';
    }
  } catch (e) {
    void e;
  }
  return (
    <div
      style={{
        position: 'fixed',
        left: 8,
        top: 48,
        zIndex: 2100,
        background: '#1f2937',
        color: '#e5e7eb',
        border: '1px solid #334155',
        borderRadius: 999,
        padding: '3px 8px',
        fontSize: 11,
        fontFamily: 'monospace',
      }}
      title={`Phaser ${version}`}
      data-testid="engine-badge"
    >
      Phaser {version}
    </div>
  );
}
