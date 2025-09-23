import React, { useEffect, useMemo, useRef, useState } from 'react';
import { executeAction, getRecentActions } from '../actions/ActionRegistry';
import * as SI from '../search/SearchIndex';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
      const meta = isMac ? e.metaKey : e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        lastFocused.current = document.activeElement as HTMLElement;
        setOpen(true);
      }
      if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open && lastFocused.current) {
      try {
        lastFocused.current.focus();
      } catch (e) {
        void e;
      }
    }
  }, [open]);

  const results = useMemo(() => {
    const items = query.trim()
      ? SI.search(query)
      : getRecentActions().map((a, idx) => ({
          type: 'action' as const,
          id: `${a.id}-${idx}`,
          label: `${a.id}`,
          actionRef: { actionId: a.id, payload: a.payload },
          score: 0,
        }));
    return items.slice(0, 20);
  }, [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((v) => Math.min(v + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((v) => Math.max(v - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const sel = results[active];
      if (sel?.actionRef) executeAction(sel.actionRef.actionId as any, sel.actionRef.payload);
      setOpen(false);
      setQuery('');
      setActive(0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onClick={() => setOpen(false)}
      data-testid="palette-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
      }}
    >
      <div
        role="combobox"
        aria-expanded="true"
        aria-owns="palette-list"
        aria-haspopup="listbox"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: '90vw',
          background: '#0b1220',
          border: '1px solid #334155',
          borderRadius: 12,
          boxShadow: '0 12px 34px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ padding: 12, borderBottom: '1px solid #1f2937' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search agents, houses, interiors, actions…"
            aria-controls="palette-list"
            aria-autocomplete="list"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: '#0f172a',
              color: '#e5e7eb',
              border: '1px solid #334155',
              borderRadius: 8,
              outline: 'none',
            }}
          />
        </div>
        <ul
          id="palette-list"
          role="listbox"
          ref={listRef}
          aria-label={query ? `Results for ${query}` : 'Recent actions'}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            maxHeight: 360,
            overflow: 'auto',
          }}
        >
          {results.length === 0 ? (
            <li style={{ padding: 16, color: '#94a3b8' }}>No results</li>
          ) : (
            results.map((r, i) => (
              <li
                key={`${r.type}-${r.id}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (r.actionRef) executeAction(r.actionRef.actionId as any, r.actionRef.payload);
                  setOpen(false);
                  setQuery('');
                  setActive(0);
                }}
                style={{
                  padding: '10px 12px',
                  background: i === active ? '#1f2937' : 'transparent',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  borderBottom: '1px solid #111827',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 999,
                    background:
                      r.type === 'agent' ? '#0ea5e9' : r.type === 'house' ? '#10b981' : '#a78bfa',
                    color: '#0f172a',
                  }}
                >
                  {r.type}
                </span>
                <span>{r.label}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
