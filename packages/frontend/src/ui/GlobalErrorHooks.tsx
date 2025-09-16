import { useEffect } from 'react';
import { eventBus } from '../realtime/EventBus';

export function GlobalErrorHooks() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const msg = e?.message || 'Unexpected error';
      eventBus.emit('toast', { type: 'error', message: msg });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason =
        (e?.reason && (e.reason.message || String(e.reason))) || 'Unhandled promise rejection';
      eventBus.emit('toast', { type: 'error', message: reason });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
