import { useEffect, useState } from 'react';
import { eventBus } from '../realtime/EventBus';
import { ws } from '../realtime/WebSocketService';

export function ConnectionOverlay() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connected');
  useEffect(() => {
    const on = (p: { status: 'connecting' | 'connected' | 'disconnected' }) => setStatus(p.status);
    eventBus.on('connection_status', on);
    return () => eventBus.off('connection_status', on);
  }, []);
  if (status === 'connected') return null;
  const label = status === 'connecting' ? 'Connecting…' : 'Disconnected';
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        zIndex: 20,
      }}
    >
      <div
        style={{
          background: '#0b1220',
          border: '1px solid #1f2937',
          borderRadius: 10,
          padding: '16px 18px',
          color: '#e5e7eb',
          minWidth: 260,
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 12, fontWeight: 600 }}>{label}</div>
        <button
          type="button"
          onClick={() => ws.connect()}
          disabled={status === 'connecting'}
          style={{
            padding: '8px 12px',
            background: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
