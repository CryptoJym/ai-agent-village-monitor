import React, { useEffect, useRef } from 'react';
import { executeAction } from '../actions/ActionRegistry';
import { track } from '../analytics/client';

export type HouseDashboardMetrics = {
  commands: number;
  errorCount: number;
  errorRate: number;
  avgLatencyMs: number;
  lastCommandTs?: number;
};

export type HouseDashboardData = {
  houseId: string;
  name: string;
  language?: string;
  components?: string[];
  issues?: number;
  buildStatus?: string;
  stars?: number;
  agents?: Array<{ id: string; name: string }>;
  source?: string;
  metrics?: HouseDashboardMetrics;
};

type Props = {
  open: boolean;
  data?: HouseDashboardData | null;
  onClose: () => void;
  viewerRole: 'owner' | 'member' | 'visitor' | 'none';
};

export function HouseDashboardPanel({ open, data, onClose, viewerRole }: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open || !data) return;
    const handle = window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [open, data]);
  if (!open || !data) return null;
  const canManage = viewerRole === 'owner';
  const agents = data.agents ?? [];
  const components = data.components ?? [];
  const badge = (text: string) => (
    <span
      key={text}
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        background: '#1e3a8a',
        color: '#dbeafe',
        fontSize: 11,
        marginRight: 6,
        marginBottom: 6,
        border: '1px solid #3b82f6',
      }}
    >
      {text}
    </span>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`House dashboard for ${data.name}`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.4)',
        zIndex: 80,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 360,
          maxWidth: '90vw',
          height: '100%',
          background: '#0f172a',
          borderLeft: '1px solid #1f2937',
          boxShadow: '-12px 0 24px rgba(2,6,23,0.6)',
          padding: 20,
          overflowY: 'auto',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, color: '#f1f5f9' }}>{data.name}</h2>
            {data.language && (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                Primary: {data.language.toUpperCase()}
              </span>
            )}
          </div>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label="Close house dashboard"
            style={{
              background: 'transparent',
              border: '1px solid #334155',
              color: '#94a3b8',
              borderRadius: 6,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </header>
        <section style={{ marginTop: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#e2e8f0' }}>Components</h3>
          {components.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No components detected.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {components.map((c) => badge(c))}
            </div>
          )}
        </section>
        <section style={{ marginTop: 20 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#e2e8f0' }}>Status</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 8,
            }}
          >
            <StatCard label="Build" value={data.buildStatus ? data.buildStatus : 'idle'} />
            <StatCard label="Issues" value={typeof data.issues === 'number' ? data.issues : '—'} />
            <StatCard label="Stars" value={typeof data.stars === 'number' ? data.stars : '—'} />
          </div>
        </section>

        {data.metrics && (
          <section style={{ marginTop: 20 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#e2e8f0' }}>SLO metrics</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 8,
              }}
            >
              <StatCard label="Commands (24h)" value={data.metrics.commands ?? 0} />
              <StatCard
                label="Error rate"
                value={`${Math.round((data.metrics.errorRate || 0) * 100)}%`}
              />
              <StatCard label="Avg latency" value={`${data.metrics.avgLatencyMs} ms`} />
              <StatCard
                label="Last command"
                value={
                  data.metrics.lastCommandTs
                    ? new Date(data.metrics.lastCommandTs).toLocaleTimeString()
                    : '—'
                }
              />
            </div>
          </section>
        )}

        <section style={{ marginTop: 20 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#e2e8f0' }}>Agents on repo</h3>
          {agents.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>No agents assigned.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {agents.map((a) => (
                <li
                  key={a.id}
                  style={{
                    padding: '6px 0',
                    borderBottom: '1px solid #1f2937',
                    color: '#cbd5f5',
                    fontSize: 13,
                  }}
                >
                  {a.name}
                </li>
              ))}
            </ul>
          )}
        </section>

        {canManage && (
          <section style={{ marginTop: 24 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 14, color: '#e2e8f0' }}>Quick commands</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  track({
                    type: 'house_command',
                    ts: Date.now(),
                    houseId: data.houseId,
                    command: 'start_agents',
                    status: 'queued',
                  });
                  executeAction('startHouseAgents', { houseId: data.houseId });
                }}
                style={buttonStyle}
              >
                Start all agents
              </button>
              <button
                type="button"
                onClick={() => {
                  track({
                    type: 'house_command',
                    ts: Date.now(),
                    houseId: data.houseId,
                    command: 'run_checks',
                    status: 'queued',
                  });
                  executeAction('runHouseChecks', { houseId: data.houseId });
                }}
                style={buttonStyle}
              >
                Run repo checks
              </button>
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 6,
  background: '#1d4ed8',
  border: '1px solid #2563eb',
  color: '#e0f2fe',
  borderRadius: 8,
  padding: '10px 12px',
  cursor: 'pointer',
  fontSize: 13,
};

type StatProps = { label: string; value: string | number };

function StatCard({ label, value }: StatProps) {
  return (
    <div
      style={{
        border: '1px solid #1f2937',
        borderRadius: 10,
        padding: '10px 12px',
        background: '#0b1220',
      }}
    >
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, color: '#f8fafc' }}>{value}</div>
    </div>
  );
}
