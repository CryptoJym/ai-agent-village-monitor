import React, { useEffect, useMemo, useState } from 'react';
import { RolePill } from './RolePill';
import { Village, VillageSchema, type VillageAccessRow } from '../api/schemas';
import {
  getVillage,
  getAccessList,
  updateVillagePublic as apiUpdateVillagePublic,
  upsertAccess as apiUpsertAccess,
  updateAccess as apiUpdateAccess,
  removeAccess as apiRemoveAccess,
  inviteByUsername as apiInviteByUsername,
} from '../api/villages';

async function fetchJson<T>(url: string, schema: any, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...(init || {}) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return schema.parse(data);
}

export function SettingsPermissions({
  open,
  onClose,
  villageId,
}: {
  open: boolean;
  onClose: () => void;
  villageId?: string;
}) {
  const vid = useMemo(() => (villageId ? String(villageId) : null), [villageId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [village, setVillage] = useState<Village | null>(null);
  const [access, setAccess] = useState<VillageAccessRow[]>([]);
  const [viewerId, setViewerId] = useState<number | null>(null);
  const viewerRole = village?.viewerRole || 'none';
  const isOwner = viewerRole === 'owner';
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<'member' | 'visitor'>('member');
  const [inviteUsername, setInviteUsername] = useState('');

  useEffect(() => {
    if (!open || !vid) return;
    setError(null);
    (async () => {
      try {
        const [v, a] = await Promise.all([getVillage(vid), getAccessList(vid)]);
        setVillage(v);
        setAccess(a);
        try {
          const meRes = await fetch('/auth/me', { credentials: 'include' });
          if (meRes.ok) {
            const me = await meRes.json();
            if (typeof me?.id === 'number') setViewerId(me.id);
          }
        } catch {}
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      }
    })();
  }, [open, vid]);

  async function togglePublic(next: boolean) {
    if (!vid) return;
    if (!isOwner) return;
    setBusy(true);
    setError(null);
    try {
      await apiUpdateVillagePublic(vid, next);
      setVillage((v) => (v ? { ...v, isPublic: next } : v));
    } catch (e: any) {
      setError(e?.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  }

  async function addAccess() {
    const uid = Number(newUserId);
    if (!vid || !Number.isFinite(uid)) return;
    if (!isOwner) return;
    setBusy(true);
    setError(null);
    try {
      await apiUpsertAccess(vid, uid, newRole);
      const list = await getAccessList(vid);
      setAccess(list);
      setNewUserId('');
    } catch (e: any) {
      setError(e?.message || 'Failed to add');
    } finally {
      setBusy(false);
    }
  }

  async function updateRole(userId: number, role: 'owner' | 'member' | 'visitor') {
    if (!vid) return;
    if (!isOwner) return;
    setBusy(true);
    setError(null);
    try {
      await apiUpdateAccess(vid, userId, role);
      setAccess((rows) => rows.map((r) => (r.userId === userId ? { ...r, role } : r)));
    } catch (e: any) {
      setError(e?.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  }

  async function removeAccess(userId: number) {
    if (!vid) return;
    if (!isOwner) return;
    setBusy(true);
    setError(null);
    try {
      await apiRemoveAccess(vid, userId);
      setAccess((rows) => rows.filter((r) => r.userId !== userId));
    } catch (e: any) {
      setError(e?.message || 'Failed to remove');
    } finally {
      setBusy(false);
    }
  }

  async function inviteByUsername() {
    if (!vid || !inviteUsername.trim()) return;
    if (!isOwner) return;
    setBusy(true);
    setError(null);
    try {
      await apiInviteByUsername(vid, inviteUsername.trim(), newRole);
      const list = await getAccessList(vid);
      setAccess(list);
      setInviteUsername('');
    } catch (e: any) {
      setError(e?.message || 'Failed to invite');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          width: 560,
          maxWidth: '95vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          background: '#0b1220',
          border: '1px solid #334155',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <h2 style={{ margin: 0, color: '#e2e8f0' }}>Village Settings: Permissions</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: '#93c5fd',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        {error && (
          <div
            style={{
              background: '#7f1d1d',
              color: '#fee2e2',
              padding: 8,
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            {error}
          </div>
        )}
        <div style={{ marginBottom: 16, color: '#e5e7eb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>Name:</strong> <span>{village?.name || '(unknown)'}</span>
            <RolePill role={(viewerRole as any) || 'none'} you />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={!!village?.isPublic}
                onChange={(e) => togglePublic(e.target.checked)}
                disabled={busy || !isOwner}
              />
              Public village
              {!isOwner && <span style={{ fontSize: 12, color: '#94a3b8' }}>(owner only)</span>}
            </label>
          </div>
        </div>
        <hr style={{ borderColor: '#1f2937' }} />
        <div style={{ marginTop: 12 }}>
          <h3 style={{ marginTop: 0, color: '#e2e8f0' }}>Access</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, opacity: isOwner ? 1 : 0.6 }}>
            <input
              placeholder="User ID"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              disabled={!isOwner}
              style={{
                flex: 1,
                padding: 8,
                background: '#0f172a',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 6,
              }}
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as any)}
              disabled={!isOwner}
              style={{
                padding: 8,
                background: '#0f172a',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 6,
              }}
            >
              <option value="member">member</option>
              <option value="visitor">visitor</option>
            </select>
            <button
              onClick={addAccess}
              disabled={busy || !isOwner}
              style={{
                padding: '8px 12px',
                background: '#1f2937',
                color: '#e5e7eb',
                border: '1px solid #374151',
                borderRadius: 6,
                cursor: isOwner ? 'pointer' : 'not-allowed',
              }}
            >
              Add
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, opacity: isOwner ? 1 : 0.6 }}>
            <input
              placeholder="GitHub username"
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              disabled={!isOwner}
              style={{
                flex: 1,
                padding: 8,
                background: '#0f172a',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 6,
              }}
            />
            <button
              onClick={inviteByUsername}
              disabled={busy || !isOwner}
              style={{
                padding: '8px 12px',
                background: '#1f2937',
                color: '#e5e7eb',
                border: '1px solid #374151',
                borderRadius: 6,
                cursor: isOwner ? 'pointer' : 'not-allowed',
              }}
            >
              Invite
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e5e7eb' }}>
            <thead>
              <tr style={{ textAlign: 'left' }}>
                <th>User</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {access.map((row) => (
                <tr key={row.userId}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>
                        {row.username || row.userId}
                        {viewerId === row.userId && (
                          <span style={{ marginLeft: 6, fontSize: 12, color: '#93c5fd' }}>
                            (You)
                          </span>
                        )}
                      </span>
                      <span style={{ opacity: 0.95 }}>
                        <RolePill role={row.role as any} you={viewerId === row.userId} />
                      </span>
                    </div>
                  </td>
                  <td>
                    <select
                      value={row.role}
                      onChange={(e) => updateRole(row.userId, e.target.value as any)}
                      disabled={busy || !isOwner}
                      style={{
                        padding: 6,
                        background: '#0f172a',
                        color: '#e5e7eb',
                        border: '1px solid #334155',
                        borderRadius: 6,
                      }}
                    >
                      <option value="owner">owner</option>
                      <option value="member">member</option>
                      <option value="visitor">visitor</option>
                    </select>
                  </td>
                  <td>
                    <button
                      onClick={() => removeAccess(row.userId)}
                      disabled={busy || !isOwner}
                      style={{
                        padding: '6px 10px',
                        background: '#7f1d1d',
                        color: '#fee2e2',
                        border: '1px solid #991b1b',
                        borderRadius: 6,
                        cursor: isOwner ? 'pointer' : 'not-allowed',
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {access.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ color: '#9ca3af' }}>
                    No entries
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
