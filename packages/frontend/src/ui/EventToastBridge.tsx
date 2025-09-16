import { useEffect } from 'react';
import { eventBus } from '../realtime/EventBus';
import { useToast } from './Toast';

export function EventToastBridge() {
  const { showError, showInfo, showSuccess } = useToast();
  useEffect(() => {
    const handler = (p: { type: 'success' | 'error' | 'info'; message: string }) => {
      if (p.type === 'success') showSuccess(p.message);
      else if (p.type === 'error') showError(p.message);
      else showInfo(p.message);
    };
    eventBus.on('toast', handler);
    return () => eventBus.off('toast', handler);
  }, [showError, showInfo, showSuccess]);
  return null;
}
