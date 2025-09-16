import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type Toast = { id: string; type: 'info' | 'error' | 'success'; text: string };

type ToastContextValue = {
  toasts: Toast[];
  showInfo: (text: string) => void;
  showError: (text: string) => void;
  showSuccess: (text: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: Toast['type'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const t: Toast = { id, type, text };
    setToasts((prev) => [...prev, t]);
    // auto-dismiss after 3s
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3000);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      showInfo: (text) => push('info', text),
      showError: (text) => push('error', text),
      showSuccess: (text) => push('success', text),
    }),
    [toasts, push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts }: { toasts: Toast[] }) {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return null;
  }
  return (
    <div
      style={{
        position: 'fixed',
        right: 12,
        top: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 50,
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #1f2937',
            background:
              t.type === 'error' ? '#7f1d1d' : t.type === 'success' ? '#064e3b' : '#1f2937',
            color: '#e5e7eb',
            minWidth: 240,
            boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
          }}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
