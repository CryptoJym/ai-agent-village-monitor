import { useEffect, useState } from 'react';
import { eventBus } from '../realtime/EventBus';

export function InfoTab({ agentId }: { agentId: string }) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [latency, setLatency] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  useEffect(() => {
    const onStatus = (p: { status: 'connecting' | 'connected' | 'disconnected' }) =>
      setStatus(p.status);
    const onLatency = (p: { rttMs: number }) => setLatency(p.rttMs);
    const onAgent = (_: unknown) => setLastUpdate(Date.now());
    eventBus.on('connection_status', onStatus);
    eventBus.on('latency', onLatency);
    eventBus.on('agent_update', onAgent);
    return () => {
      eventBus.off('connection_status', onStatus);
      eventBus.off('latency', onLatency);
      eventBus.off('agent_update', onAgent);
    };
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: '8px 0', color: '#e2e8f0' }}>Agent Info</h3>
      <div style={{ color: '#94a3b8' }}>Agent: {agentId}</div>
      <div style={{ color: '#94a3b8' }}>Status: {status}</div>
      <div style={{ color: '#94a3b8' }}>
        Latency: {latency != null ? `${Math.round(latency)}ms` : 'n/a'}
      </div>
      <div style={{ color: '#94a3b8' }}>
        Last Agent Update: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : '—'}
      </div>
    </div>
  );
}
