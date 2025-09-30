import { useEffect, useState } from 'react';
import { hasStoredConsent, setConsent } from '../analytics/client';

export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
      const gpc = !!(nav && 'globalPrivacyControl' in nav && nav.globalPrivacyControl);
      const dnt =
        nav?.doNotTrack === '1' ||
        nav?.msDoNotTrack === '1' ||
        (typeof window !== 'undefined' && (window as any)?.doNotTrack === '1');
      if (!hasStoredConsent() && !gpc && !dnt) setVisible(true);
    } catch (e) {
      void e;
    }
  }, []);

  if (!visible) return null;

  const choose = async (allow: boolean) => {
    setConsent(allow);
    setVisible(false);
    try {
      // Persist on server if logged in
      await fetch('/api/users/me/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ analytics: { enabled: allow } }),
      });
    } catch (e) {
      void e;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        bottom: 16,
        padding: '12px 14px',
        background: '#0b1220',
        color: '#e2e8f0',
        border: '1px solid #334155',
        borderRadius: 8,
        zIndex: 50,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: 'min(420px, calc(100vw - 40px))',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.55)',
      }}
      role="region"
      aria-label="Analytics consent"
    >
      <div style={{ maxWidth: '60%' }}>
        Help us improve with optional usage analytics (dialogue opens, session duration, etc.). We only
        start collecting after you opt in. See our{' '}
        <a href="/docs/privacy" style={{ color: '#93c5fd' }}>
          privacy policy
        </a>{' '}
        for details.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => void choose(false)}
          style={{
            padding: '8px 12px',
            background: 'transparent',
            color: '#e2e8f0',
            border: '1px solid #475569',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          No thanks
        </button>
        <button
          type="button"
          onClick={() => void choose(true)}
          style={{
            padding: '8px 12px',
            background: '#1f2937',
            color: '#e2e8f0',
            border: '1px solid #374151',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Allow
        </button>
      </div>
    </div>
  );
}
