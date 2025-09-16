import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

type Role = 'owner' | 'member' | 'visitor' | null;

const ROLE_STYLES: Record<
  Exclude<Role, null>,
  { bg: string; fg: string; border: string; label: string }
> = {
  owner: { bg: '#065f46', fg: '#d1fae5', border: '#064e3b', label: 'Owner' },
  member: { bg: '#1f2937', fg: '#e5e7eb', border: '#374151', label: 'Member' },
  visitor: { bg: '#374151', fg: '#e5e7eb', border: '#4b5563', label: 'Visitor' },
};

export function RoleBadge() {
  const { id } = useParams();
  const [role, setRole] = useState<Role>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) {
        setRole(null);
        return;
      }
      try {
        const res = await fetch(`/api/villages/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        if (!cancelled) setRole((data.viewerRole as Role) ?? null);
      } catch {
        if (!cancelled) setRole(null);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!role) return null;
  const s = ROLE_STYLES[role];
  return (
    <span
      aria-label={`Role: ${s.label}`}
      style={{
        marginLeft: 8,
        padding: '3px 8px',
        borderRadius: 9999,
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        fontSize: 12,
        verticalAlign: 'middle',
      }}
    >
      {s.label}
    </span>
  );
}
