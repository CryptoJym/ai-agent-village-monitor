import React, { useEffect, useRef, useState } from 'react';
import { executeAction } from '../actions/ActionRegistry';

export type AgentQuickAction = 'toggleStartStop' | 'runRecentTool' | 'goToHouse';

export function AgentListItem({
  agentId,
  name,
  status = 'idle',
}: {
  agentId: string;
  name: string;
  status?: 'idle' | 'working' | 'debugging' | 'error';
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY });
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e as any).key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        setMenu({ x: r.left + 8, y: r.top + r.height });
      }
    };
    el.addEventListener('contextmenu', onContext);
    el.addEventListener('keydown', onKey);
    return () => {
      el.removeEventListener('contextmenu', onContext);
      el.removeEventListener('keydown', onKey);
    };
  }, []);

  async function handle(action: AgentQuickAction) {
    setLoading(true);
    try {
      if (action === 'toggleStartStop') {
        if (status === 'idle') await executeAction('startAgent', { agentId });
        else await executeAction('stopAgent', { agentId });
      } else if (action === 'runRecentTool') {
        await executeAction('runRecentTool', { agentId, toolId: 'last' });
      } else if (action === 'goToHouse') {
        await executeAction('navigateToHouse', { houseId: 'home' });
      }
    } finally {
      setLoading(false);
      setMenu(null);
    }
  }

  return (
    <div
      ref={elRef}
      tabIndex={0}
      role="button"
      aria-label={`Agent ${name}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        border: '1px solid #334155',
        borderRadius: 8,
        color: '#e5e7eb',
        background: '#0f172a',
        outline: 'none',
      }}
      data-testid="agent-list-item"
    >
      <span>{name}</span>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>{status}</span>
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          busy={loading}
          onClose={() => setMenu(null)}
          items={[
            {
              key: 'toggle',
              label: status === 'idle' ? 'Start' : 'Stop',
              onSelect: () => handle('toggleStartStop'),
              disabled: loading,
            },
            {
              key: 'tool',
              label: 'Run Recent Tool',
              onSelect: () => handle('runRecentTool'),
              disabled: loading,
            },
            {
              key: 'house',
              label: 'Go To House',
              onSelect: () => handle('goToHouse'),
              disabled: loading,
            },
          ]}
        />
      )}
    </div>
  );
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
  busy,
}: {
  x: number;
  y: number;
  items: { key: string; label: string; onSelect: () => void; disabled?: boolean }[];
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') setIndex((i) => Math.min(i + 1, items.length - 1));
      if (e.key === 'ArrowUp') setIndex((i) => Math.max(i - 1, 0));
      if (e.key === 'Enter') items[index]?.onSelect();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [items, index, onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Agent actions"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: '#0b1220',
        border: '1px solid #334155',
        borderRadius: 8,
        minWidth: 160,
        zIndex: 80,
        boxShadow: '0 12px 24px rgba(0,0,0,0.4)',
      }}
      data-testid="context-menu"
    >
      {items.map((it, i) => (
        <div
          key={it.key}
          role="menuitem"
          aria-disabled={!!it.disabled}
          onMouseEnter={() => setIndex(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => !it.disabled && it.onSelect()}
          style={{
            padding: '8px 10px',
            color: it.disabled ? '#64748b' : '#e5e7eb',
            cursor: it.disabled ? 'not-allowed' : 'pointer',
            background: i === index ? '#1f2937' : 'transparent',
            userSelect: 'none',
          }}
        >
          {busy && i === index ? '… ' : ''}
          {it.label}
        </div>
      ))}
    </div>
  );
}
