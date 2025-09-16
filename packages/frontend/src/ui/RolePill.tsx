import React from 'react';

export type Role = 'owner' | 'member' | 'visitor' | 'public' | 'none';

export function RolePill({ role, you }: { role: Role; you?: boolean }) {
  const label =
    role === 'owner'
      ? 'Owner'
      : role === 'member'
        ? 'Member'
        : role === 'visitor'
          ? 'Visitor'
          : role === 'public'
            ? 'Public'
            : 'Guest';
  const bg =
    role === 'owner'
      ? '#14532d'
      : role === 'member'
        ? '#1e3a8a'
        : role === 'visitor' || role === 'public'
          ? '#334155'
          : '#374151';
  const title = you ? `${label} • You` : label;
  return (
    <span
      aria-label={title}
      title={title}
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 12,
        border: '1px solid #334155',
        background: bg,
        color: '#e5e7eb',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span>{label}</span>
      {you && (
        <span
          style={{
            padding: '1px 6px',
            borderRadius: 999,
            fontSize: 10,
            border: '1px solid #475569',
            background: '#0f172a',
            color: '#cbd5e1',
          }}
        >
          You
        </span>
      )}
    </span>
  );
}
