import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { queueAwarePost } from '../utils/queueFetch';
import { useParams } from 'react-router-dom';
import { useViewerRole } from '../hooks/useViewerRole';
import { eventBus } from '../realtime/EventBus';
import { announce, createLiveRegion } from '../utils/a11y';
import { useTranslation } from 'react-i18next';
import { formatTime } from '../utils/time';

type Msg = { id: string; ts: number; text: string; role: 'system' | 'agent' | 'user' };

export function ThreadTab({ agentId }: { agentId: string }) {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [latency, setLatency] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const params = useParams();
  const villageId = params.id as string | undefined;
  const role = useViewerRole(villageId);
  const canControl = !villageId || role === 'owner';

  useEffect(() => {
    createLiveRegion();
    // Throttle stream updates into animation frames to reduce reflows under high volume
    const queue: Msg[] = [];
    let rafId = 0;
    const flush = () => {
      rafId = 0;
      if (queue.length === 0) return;
      const batch = queue.splice(0, queue.length);
      setMessages((prev) => [...prev, ...batch]);
      const key = batch.length === 1 ? 'thread.newMessages' : 'thread.newMessages_plural';
      announce(t(key, { count: batch.length }));
    };
    const onStream = (p: { agentId: string; message: string; ts?: number }) => {
      const m: Msg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ts: p.ts ?? Date.now(),
        text: p.message,
        role: 'agent',
      };
      queue.push(m);
      if (!rafId) rafId = window.requestAnimationFrame(flush);
    };
    const onStatus = (p: { status: 'connecting' | 'connected' | 'disconnected' }) =>
      setStatus(p.status);
    const onLatency = (p: { rttMs: number }) => setLatency(p.rttMs);
    eventBus.on('work_stream', onStream);
    eventBus.on('connection_status', onStatus);
    eventBus.on('latency', onLatency);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      eventBus.off('work_stream', onStream);
      eventBus.off('connection_status', onStatus);
      eventBus.off('latency', onLatency);
    };
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  const indicator = useMemo(() => {
    const color =
      status === 'connected' ? '#10b981' : status === 'connecting' ? '#f59e0b' : '#ef4444';
    const label = t(`thread.status.${status}`);
    return (
      <div data-testid="thread-status" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 9999,
            background: color,
          }}
        />
        <span style={{ color: '#cbd5e1' }}>{label}</span>
        {latency != null && (
          <span style={{ color: '#64748b', marginLeft: 8 }}>
            {t('thread.latency', { ms: Math.round(latency) })}
          </span>
        )}
      </div>
    );
  }, [status, latency]);

  const submit = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-user`, ts: Date.now(), text, role: 'user' },
    ]);
    setInput('');
    try {
      await queueAwarePost(`/api/agents/${encodeURIComponent(agentId)}/command`, {
        type: 'task',
        text,
      });
    } catch {}
  }, [input, agentId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid #1f2937',
          background: '#0b1220',
        }}
      >
        <div style={{ color: '#94a3b8' }}>{t('thread.agentLabel', { id: agentId })}</div>
        {indicator}
      </div>
      <div
        ref={listRef}
        style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', background: '#0f172a' }}
        data-testid="thread-list"
      >
        {messages.map((m) => (
          <div key={m.id} style={{ margin: '6px 0', display: 'flex', gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                color: '#64748b',
                width: 100,
                flexShrink: 0,
              }}
            >
              {formatTime(m.ts, i18n.language)}
            </span>
            <div
              style={{
                color: m.role === 'user' ? '#e2e8f0' : '#cbd5e1',
                background: m.role === 'user' ? '#1f2937' : '#0b1220',
                border: '1px solid #1f2937',
                borderRadius: 8,
                padding: '8px 10px',
                maxWidth: '80%',
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: 12,
          borderTop: '1px solid #1f2937',
          background: '#0b1220',
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canControl) void submit();
            }
          }}
          placeholder={t('thread.inputPlaceholder')}
          style={{
            flex: 1,
            padding: '10px 12px',
            background: '#0f172a',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: 8,
            outline: 'none',
          }}
          data-testid="thread-input"
          disabled={!canControl}
          title={canControl ? undefined : t('thread.ownerRequired')}
        />
        <button
          type="button"
          onClick={() => canControl && void submit()}
          style={{
            padding: '10px 14px',
            background: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: 8,
            cursor: 'pointer',
          }}
          data-testid="thread-send"
          disabled={!canControl}
          title={canControl ? undefined : t('thread.ownerRequired')}
        >
          {t('thread.send')}
        </button>
      </div>
    </div>
  );
}
