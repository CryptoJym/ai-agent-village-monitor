import React, { useEffect, useState } from 'react';

type KpiSummary = {
  ok: boolean;
  daily_active_villages?: number;
  dialogue_opens?: number;
  commands_executed?: number;
  avg_session_sec?: number;
  fast_travel?: { count: number; avg_ms: number; over_2s: number };
};

export function FastTravelMetrics() {
  const [data, setData] = useState<KpiSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch('/api/internal/kpi/summary', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as KpiSummary;
      setData(j);
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
      setData(null);
    }
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const ft = data?.fast_travel;
  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        top: 150,
        width: 260,
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
        <h3 style={{ margin: 0, fontSize: 14, color: '#93c5fd' }}>Fast Travel</h3>
        <button
          onClick={load}
          style={{
            fontSize: 12,
            background: 'transparent',
            color: '#93c5fd',
            border: '1px solid #1e3a8a',
            borderRadius: 6,
            padding: '2px 6px',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>
      {error && <p style={{ color: '#fecaca', margin: '8px 0 0' }}>{error}</p>}
      {!error && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#cbd5e1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Count</span>
            <strong>{ft?.count ?? 0}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Avg (ms)</span>
            <strong>{ft?.avg_ms ?? 0}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Over 2s</span>
            <strong style={{ color: (ft?.over_2s ?? 0) > 0 ? '#fca5a5' : '#a7f3d0' }}>
              {ft?.over_2s ?? 0}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
