import React, { useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '../utils/errors';

type SyncRun = {
  ts: number;
  repos: number;
  houses: number;
  created: number;
  updated: number;
  archived: number;
  discrepancy: number; // 0..1
};

type HealthResponse = {
  latest: SyncRun | null;
  recent: SyncRun[];
};

export function SyncHealth({ villageId }: { villageId: string }) {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/villages/${encodeURIComponent(villageId)}/sync/health`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as HealthResponse;
      setData(j);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to load sync health'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      await load();
      // refresh periodically
      const id = window.setInterval(() => {
        if (alive) void load();
      }, 30_000);
      return () => window.clearInterval(id);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [villageId]);

  const latest = data?.latest || null;
  const pct = useMemo(() => (latest ? (latest.discrepancy * 100).toFixed(2) : '—'), [latest]);
  const staleMs = latest ? Date.now() - latest.ts : 0;
  const stale = latest ? formatDuration(staleMs) : '—';
  const warn = latest ? latest.discrepancy > 0.005 : false; // >0.5%

  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        top: 52,
        width: 280,
        background: '#0b1220',
        border: '1px solid #334155',
        borderRadius: 10,
        color: '#e5e7eb',
        padding: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 14, color: '#93c5fd' }}>Sync Health</h3>
        <button
          onClick={load}
          disabled={loading}
          style={{
            fontSize: 12,
            background: 'transparent',
            color: '#93c5fd',
            border: '1px solid #1e3a8a',
            borderRadius: 6,
            padding: '2px 6px',
            cursor: loading ? 'wait' : 'pointer',
          }}
          aria-busy={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {error && <p style={{ color: '#fecaca', margin: '8px 0 0' }}>{String(error)}</p>}
      {!error && (
        <div style={{ marginTop: 8, fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Discrepancy</span>
            <strong style={{ color: warn ? '#fca5a5' : '#a7f3d0' }}>{pct}%</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8' }}>Last Run</span>
            <span>{stale} ago</span>
          </div>
          {latest && (
            <div
              style={{
                marginTop: 6,
                color: '#cbd5e1',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                rowGap: 2,
              }}
            >
              <span>Repos</span>
              <span style={{ textAlign: 'right' }}>{latest.repos}</span>
              <span>Houses</span>
              <span style={{ textAlign: 'right' }}>{latest.houses}</span>
              <span>Created</span>
              <span style={{ textAlign: 'right' }}>{latest.created}</span>
              <span>Updated</span>
              <span style={{ textAlign: 'right' }}>{latest.updated}</span>
              <span>Archived</span>
              <span style={{ textAlign: 'right' }}>{latest.archived}</span>
            </div>
          )}
          {data?.recent?.length ? (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#93c5fd', marginBottom: 4 }}>Recent</div>
              <div style={{ maxHeight: 90, overflowY: 'auto' }}>
                {data.recent.slice(0, 5).map((r, i) => (
                  <div
                    key={r.ts + ':' + i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: '#94a3b8',
                    }}
                  >
                    <span>{new Date(r.ts).toLocaleTimeString()}</span>
                    <span>{(r.discrepancy * 100).toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}
