import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: '#7f1d1d',
        color: '#fee2e2',
        borderBottom: '1px solid #991b1b',
        padding: '6px 12px',
        zIndex: 60,
        textAlign: 'center',
        fontSize: 14,
      }}
    >
      You are offline. Some features may be unavailable.
    </div>
  );
}
