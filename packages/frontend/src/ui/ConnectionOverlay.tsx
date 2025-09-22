import { useEffect, useState } from 'react';
import { eventBus } from '../realtime/EventBus';
import { ws } from '../realtime/WebSocketService';

export function ConnectionOverlay() {
  const [state, setState] = useState<{
    status: 'connecting' | 'connected' | 'disconnected';
    error?: string | null;
  }>({ status: 'connected' });

  useEffect(() => {
    const on = (p: { status: 'connecting' | 'connected' | 'disconnected'; error?: string }) =>
      setState({ status: p.status, error: p.error });
    eventBus.on('connection_status', on);
    return () => eventBus.off('connection_status', on);
  }, []);

  if (state.status === 'connected') return null;
  const label = state.status === 'connecting' ? 'Connecting…' : 'Disconnected';
  const errorDetail = state.error && state.status !== 'connecting' ? state.error : null;
  return (
    <div
      data-testid="connection-overlay"
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
        <div style={{ marginBottom: 8, fontWeight: 600 }}>{label}</div>
        {errorDetail && (
          <div
            style={{
              marginBottom: 12,
              fontSize: 13,
              color: '#fca5a5',
              wordBreak: 'break-word',
            }}
          >
            {errorDetail}
          </div>
        )}
        <button
          type="button"
          onClick={() => ws.connect()}
          disabled={state.status === 'connecting'}
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
