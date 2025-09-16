import { useEffect, useMemo, useRef, useState } from 'react';
import { getUIState, setUIState } from '../state/uiState';
import { ThreadTab } from './ThreadTab';
import { useTranslation } from 'react-i18next';
import { ControlTab } from './ControlTab';
import { InfoTab } from './InfoTab';
import { ToastProvider } from './Toast';

export type DialogueUIProps = {
  open: boolean;
  onClose: () => void;
  agentId?: string;
  initialTab?: 'thread' | 'control' | 'info';
  onTabChange?: (tab: 'thread' | 'control' | 'info') => void;
};

type TabKey = 'thread' | 'control' | 'info';

export function DialogueUI({
  open,
  onClose,
  agentId = 'demo-agent',
  initialTab,
  onTabChange,
}: DialogueUIProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>(() => {
    if (initialTab) return initialTab;
    try {
      const st = getUIState();
      if (
        st.dialogueTab &&
        (st.dialogueTab === 'thread' || st.dialogueTab === 'control' || st.dialogueTab === 'info')
      ) {
        return st.dialogueTab as any;
      }
    } catch {}
    return 'thread';
  });
  const [heightPct, setHeightPct] = useState(0.3);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const update = () => {
      const mobile = window.innerWidth <= 640;
      setHeightPct(mobile ? 0.5 : 0.3);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '1') {
        e.preventDefault();
        setTab('thread');
      } else if (e.key === '2') {
        e.preventDefault();
        setTab('control');
      } else if (e.key === '3') {
        e.preventDefault();
        setTab('info');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Persist selected agent and tab; restore tab on open
  useEffect(() => {
    try {
      setUIState({ selectedAgentId: agentId });
    } catch {}
  }, [agentId]);

  useEffect(() => {
    if (open) {
      try {
        const st = getUIState();
        if (
          st.dialogueTab &&
          (st.dialogueTab === 'thread' || st.dialogueTab === 'control' || st.dialogueTab === 'info')
        ) {
          setTab(st.dialogueTab as any);
        }
      } catch {}
    }
  }, [open]);

  useEffect(() => {
    try {
      setUIState({ dialogueTab: tab as any });
    } catch {}
  }, [tab]);

  // Reflect prop changes to initialTab (e.g., hash hydration)
  useEffect(() => {
    if (initialTab && initialTab !== tab) setTab(initialTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);

  // Notify parent of tab changes (for URL hash sync)
  useEffect(() => {
    onTabChange?.(tab);
  }, [tab, onTabChange]);

  // Focus management: trap initial focus and restore on close
  useEffect(() => {
    if (open) {
      prevFocusRef.current = (document.activeElement as HTMLElement) || null;
      setTimeout(() => closeBtnRef.current?.focus(), 0);
    } else {
      // restore focus to previous element
      prevFocusRef.current?.focus?.();
    }
  }, [open]);

  const styles = useMemo((): {
    overlay: React.CSSProperties;
    panel: React.CSSProperties;
    tabs: React.CSSProperties;
    tabBtn: (active: boolean) => React.CSSProperties;
    body: React.CSSProperties;
  } => {
    const panelH = `${Math.round(heightPct * 100)}vh`;
    return {
      overlay: {
        position: 'fixed' as const,
        inset: 0,
        background: open ? 'rgba(0,0,0,0.35)' : 'transparent',
        pointerEvents: (open ? 'auto' : 'none') as React.CSSProperties['pointerEvents'],
        transition: 'background 200ms ease',
        zIndex: 30,
      },
      panel: {
        position: 'absolute' as const,
        left: 0,
        right: 0,
        bottom: 0,
        height: panelH,
        background: '#0b1220',
        borderTop: '1px solid #1f2937',
        boxShadow: '0 -10px 30px rgba(0,0,0,0.25)',
        transform: open ? 'translateY(0%)' : 'translateY(100%)',
        transition: 'transform 300ms ease-out',
        display: 'flex',
        flexDirection: 'column' as const,
      },
      tabs: {
        display: 'flex',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid #1f2937',
        background: '#0f172a',
      },
      tabBtn: (active: boolean) => ({
        padding: '6px 10px',
        borderRadius: 6,
        background: active ? '#1f2937' : 'transparent',
        color: '#e5e7eb',
        border: '1px solid #374151',
        cursor: 'pointer',
      }),
      body: {
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      },
    };
  }, [open, heightPct]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      ref={overlayRef}
      style={styles.overlay}
      onClick={onClose}
      data-testid="dialogue-overlay"
      aria-hidden={!open}
    >
      <section
        style={styles.panel}
        onClick={stop}
        data-testid="dialogue-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('dialogue.ariaPanel')}
      >
        <header style={styles.tabs} data-testid="dialogue-tabs" aria-label={t('dialogue.ariaTabs')}>
          <button
            style={styles.tabBtn(tab === 'thread')}
            onClick={() => setTab('thread')}
            aria-pressed={tab === 'thread'}
            aria-label={`${t('dialogue.thread')} tab (1)`}
          >
            {t('dialogue.thread')}
          </button>
          <button
            style={styles.tabBtn(tab === 'control')}
            onClick={() => setTab('control')}
            aria-pressed={tab === 'control'}
            aria-label={`${t('dialogue.control')} tab (2)`}
          >
            {t('dialogue.control')}
          </button>
          <button
            style={styles.tabBtn(tab === 'info')}
            onClick={() => setTab('info')}
            aria-pressed={tab === 'info'}
            aria-label={`${t('dialogue.info')} tab (3)`}
          >
            {t('dialogue.info')}
          </button>
          <div style={{ marginLeft: 'auto' }}>
            <button
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                background: 'transparent',
                color: '#e5e7eb',
                border: '1px solid #374151',
                cursor: 'pointer',
              }}
              onClick={onClose}
              aria-label={t('dialogue.closeAria')}
              ref={closeBtnRef}
            >
              {t('dialogue.closeText')}
            </button>
          </div>
        </header>
        <ToastProvider>
          <div style={styles.body}>
            {tab === 'thread' && <ThreadTab agentId={agentId} />}
            {tab === 'control' && <ControlTab agentId={agentId} />}
            {tab === 'info' && <InfoTab agentId={agentId} />}
          </div>
        </ToastProvider>
      </section>
    </div>
  );
}
