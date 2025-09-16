import React from 'react';

type Role = 'owner' | 'member' | 'visitor' | 'you';

const COLORS: Record<Role, { bg: string; fg: string; border: string; label: string }> = {
  owner: { bg: '#064e3b', fg: '#d1fae5', border: '#065f46', label: 'Owner' },
  member: { bg: '#0c4a6e', fg: '#e0f2fe', border: '#075985', label: 'Member' },
  visitor: { bg: '#111827', fg: '#e5e7eb', border: '#1f2937', label: 'Visitor' },
  you: { bg: '#1f2937', fg: '#fef08a', border: '#374151', label: 'You' },
};

export function Badge({ role, title }: { role: Role; title?: string }) {
  const c = COLORS[role];
  return (
    <span
      title={title || c.label}
      aria-label={`${c.label} badge`}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
        fontSize: 11,
        lineHeight: '16px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {c.label}
    </span>
  );
}
