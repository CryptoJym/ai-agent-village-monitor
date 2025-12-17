import React, { useEffect, useMemo, useRef, useState } from 'react';
import { csrfFetch } from '../../api/csrf';

type StepKey = 'login' | 'org' | 'install' | 'create' | 'sync' | 'enter' | 'demo';

type User = { id: number; username: string; avatarUrl?: string | null } | null;

async function fetchMe(): Promise<User> {
  try {
    const res = await fetch('/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as User;
  } catch {
    return null;
  }
}

type Org = { id: string | number; login: string };
async function fetchOrgs(): Promise<Org[]> {
  try {
    const res = await fetch('/api/github/orgs', { credentials: 'include' });
    if (!res.ok) throw new Error('bad');
    const data = (await res.json()) as Array<{ id?: string | number; login: string } | string>;
    return data.map((o) =>
      typeof o === 'string' ? { id: o, login: o } : { id: o.id ?? o.login, login: o.login },
    );
  } catch {
    // graceful fallback
    return [
      { id: 'demo-org', login: 'demo-org' },
      { id: 'sample-team', login: 'sample-team' },
    ];
  }
}

export function OnboardingStepper({
  open,
  onClose,
  onEnterVillage,
}: {
  open: boolean;
  onClose: () => void;
  onEnterVillage: (villageId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);
  const [user, setUser] = useState<User>(null);
  const [step, setStep] = useState<StepKey>('login');
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');
  const [syncMsg, setSyncMsg] = useState<string>('');
  const [createdVillageId, setCreatedVillageId] = useState<string>('');
  const [installing, setInstalling] = useState(false);
  const [installMsg, setInstallMsg] = useState('');
  const [popupBlocked, setPopupBlocked] = useState(false);
  const timings = useRef<{ [k in StepKey]?: number }>({});
  const startedAt = useRef<number>(Date.now());
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  // Trap focus within the dialog while open
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const node = containerRef.current;
      if (!node) return;
      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // Track step timing
  useEffect(() => {
    if (!open) return;
    timings.current[step] = Date.now();
  }, [step, open]);

  function reportTimings(outcome: 'success' | 'demo' | 'cancel') {
    const data = {
      outcome,
      startedAt: startedAt.current,
      timings: timings.current,
    };
    try {
      const blob = new Blob([JSON.stringify({ type: 'onboarding_timings', data })], {
        type: 'application/json',
      });
      navigator.sendBeacon?.('/analytics', blob);
    } catch (e) {
      void e;
    }
    console.info('[analytics] onboarding_timings', data);
  }

  useEffect(() => {
    if (!open) return;
    (async () => {
      const me = await fetchMe();
      setUser(me);
      if (me) setStep('org');
    })();
  }, [open]);

  useEffect(() => {
    if (open && step === 'org') {
      (async () => setOrgs(await fetchOrgs()))();
    }
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => firstFocusableRef.current?.focus(), 0);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const focusable = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled'));
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }, [step, open]);

  const steps = useMemo(
    () => [
      { key: 'login', title: 'Login' },
      { key: 'org', title: 'Select Organization' },
      { key: 'install', title: 'Install App / Grant Scopes' },
      { key: 'create', title: 'Create Village' },
      { key: 'sync', title: 'Sync Repos & Houses' },
      { key: 'enter', title: 'Enter Village' },
      { key: 'demo', title: 'Try Demo Mode' },
    ],
    [],
  );

  if (!open) return null;

  function announce(message: string) {
    if (!liveRegionRef.current) return;
    liveRegionRef.current.textContent = message;
  }

  function doLogin() {
    setError('');
    setPopupBlocked(false);
    const w = window.open('/auth/login', 'gh_login', 'width=680,height=760,noopener');
    if (!w) {
      setPopupBlocked(true);
      announce('Pop-up was blocked. Use the open in this tab option.');
    }
    const start = Date.now();
    const tick = async () => {
      const me = await fetchMe();
      if (me) {
        setUser(me);
        setStep('org');
        try {
          if (w && !w.closed) w.close();
        } catch (e) {
          void e;
        }
        announce('GitHub login detected. Continue to organization selection.');
        return;
      }
      if (!w || w.closed) {
        setError(
          'GitHub login window closed. You can reopen it or continue with the fallback option.',
        );
        announce('GitHub login window closed. Use fallback button to proceed.');
        return;
      }
      if (Date.now() - start > 60_000) {
        setError('Login timed out. Please try again or use the fallback link.');
        announce('Login timed out. Choose retry or fallback.');
        try {
          if (w && !w.closed) w.close();
        } catch (e) {
          void e;
        }
        return;
      }
      setTimeout(tick, 700);
    };
    setTimeout(tick, 700);
  }

  function getAppInstallUrl(): string | null {
    const env: any =
      (import.meta as unknown as { env?: Record<string, string> })?.env || ({} as any);
    const url = env.VITE_GITHUB_APP_INSTALL_URL as string | undefined;
    if (url && /^https?:\/\//.test(url)) return url;
    const slug = env.VITE_GITHUB_APP_SLUG as string | undefined;
    if (slug && slug.trim()) return `https://github.com/apps/${slug.trim()}/installations/new`;
    return null;
  }

  async function verifyScopesAndInstall(): Promise<boolean> {
    try {
      const r = await fetch('/api/github/orgs', { credentials: 'include' });
      if (!r.ok) return false;
      const items: any[] = await r.json();
      return Array.isArray(items) && items.length >= 1;
    } catch {
      return false;
    }
  }

  function openInstall() {
    const url = getAppInstallUrl();
    setError('');
    setInstallMsg('Waiting for installation to complete…');
    announce('Waiting for GitHub installation to complete.');
    setInstalling(true);
    let w: Window | null = null;
    if (url) {
      try {
        w = window.open(url, 'gh_install', 'width=980,height=840,noopener');
        if (!w) {
          setPopupBlocked(true);
          announce('Installation window blocked. Use open in current tab.');
        }
      } catch (e) {
        void e;
      }
    }
    const start = Date.now();
    const tick = async () => {
      const ok = await verifyScopesAndInstall();
      if (ok) {
        setInstallMsg('Installation detected. Continuing…');
        announce('Installation detected. Moving to create village step.');
        try {
          if (w && !w.closed) w.close();
        } catch (e) {
          void e;
        }
        setInstalling(false);
        setStep('create');
        return;
      }
      if (Date.now() - start > 90_000) {
        setInstalling(false);
        setInstallMsg('');
        setError(
          'We could not confirm the install/scopes. Retry, review the GitHub app scopes, or continue anyway.',
        );
        announce('Could not confirm installation. Provide scopes or retry.');
        return;
      }
      setTimeout(tick, 1000);
    };
    setTimeout(tick, 1200);
  }

  async function doCreateVillage() {
    setBusy(true);
    setError('');
    try {
      const res = await csrfFetch('/api/villages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedOrg?.login || 'Demo Village',
          github_org_id: selectedOrg?.id || selectedOrg?.login || 'demo-org',
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = await res.json();
      const vid = String(body.id);
      setCreatedVillageId(vid);
      setStep('sync');
      announce('Village created. Syncing repositories.');
      try {
        await csrfFetch(`/api/villages/${encodeURIComponent(vid)}/houses/sync`, {
          method: 'POST',
        });
      } catch (e) {
        void e;
      }
      const start = Date.now();
      const poll = async () => {
        try {
          setSyncMsg('Syncing repositories…');
          announce('Syncing repositories. This may take up to a minute.');
          const r = await fetch(`/api/villages/${encodeURIComponent(vid)}`, {
            credentials: 'include',
          });
          if (r.ok) {
            const j = await r.json();
            if (j?.lastSynced) {
              setStep('enter');
              reportTimings('success');
              announce('Sync complete. Entering village.');
              onEnterVillage(vid);
              return;
            }
          }
        } catch (e) {
          void e;
        }
        if (Date.now() - start > 60_000) {
          setError('Sync timed out. Retry or continue to demo mode.');
          setSyncMsg('');
          announce('Sync timed out. Retry sync or continue in demo mode.');
          return;
        }
        setTimeout(poll, 1000);
      };
      setTimeout(poll, 1200);
    } catch (e: any) {
      void e;
      setError('Create failed. Switching to demo mode.');
      announce('Village creation failed. Opening demo mode.');
      setStep('demo');
    } finally {
      setBusy(false);
    }
  }

  function doDemo() {
    reportTimings('demo');
    announce('Entering demo village.');
    onEnterVillage('demo');
  }

  const containerStyles: React.CSSProperties = {
    width: 'min(720px, 96vw)',
    background: '#0b1220',
    border: '1px solid #1f2a3a',
    borderRadius: 12,
    padding: 'clamp(16px, 2vw, 32px)',
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
    maxHeight: '90vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  };

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2,8,23,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(16px, 3vw, 48px)',
        zIndex: 2000,
      }}
      role="presentation"
    >
      <div
        ref={containerRef}
        style={containerStyles}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
      >
        <div style={headerStyles}>
          <h2 id="onboarding-title" style={{ margin: 0, fontSize: 'clamp(1.25rem, 2vw, 1.75rem)' }}>
            Onboarding
          </h2>
          <button
            onClick={() => {
              reportTimings('cancel');
              onClose();
            }}
            aria-label="Close onboarding"
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #334155',
              borderRadius: 8,
              cursor: 'pointer',
              padding: '6px 10px',
              minHeight: 44,
            }}
          >
            Close
          </button>
        </div>

        <p id="onboarding-description" style={{ margin: 0, color: '#94a3b8' }}>
          Connect GitHub, sync your repositories, and enter your village. Steps adapt to your
          permissions, and all progress is saved.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}
        >
          {steps.map((s, i) => (
            <span
              key={s.key}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                background: s.key === step ? '#1f2937' : '#0f172a',
                border: '1px solid #334155',
                fontSize: 12,
              }}
              aria-current={s.key === step}
            >
              {i + 1}. {s.title}
            </span>
          ))}
        </div>

        {error && (
          <div style={{ color: '#fca5a5' }} role="alert">
            {error}
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                onClick={() => {
                  setError('');
                  if (step === 'org') {
                    (async () => setOrgs(await fetchOrgs()))();
                  }
                }}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #334155' }}
              >
                Retry current step
              </button>
              <button
                onClick={() => setStep('login')}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #334155' }}
              >
                Back to login
              </button>
            </div>
          </div>
        )}

        <div ref={liveRegionRef} role="status" aria-live="polite" style={{ minHeight: 20 }} />

        {step === 'login' && (
          <section style={{ display: 'grid', gap: 16 }}>
            <p>
              Sign in with GitHub. If your browser blocks pop-ups, use “Open in this tab” or allow
              pop-ups for this site.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button
                ref={firstFocusableRef}
                onClick={doLogin}
                style={{
                  padding: '12px 16px',
                  background: '#1f2937',
                  color: '#e5e7eb',
                  border: '1px solid #334155',
                  borderRadius: 12,
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                Login with GitHub (pop-up)
              </button>
              <a
                href="/auth/login"
                style={{
                  padding: '12px 16px',
                  background: '#0b1220',
                  color: '#e5e7eb',
                  border: '1px solid #334155',
                  borderRadius: 12,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 44,
                }}
                onClick={() => setPopupBlocked(false)}
              >
                Open GitHub in this tab
              </a>
              <button
                type="button"
                onClick={() => setStep('demo')}
                style={{
                  padding: '12px 16px',
                  background: '#0f172a',
                  color: '#e5e7eb',
                  border: '1px solid #334155',
                  borderRadius: 12,
                  cursor: 'pointer',
                  minHeight: 44,
                }}
              >
                Explore demo first
              </button>
            </div>
            {user && (
              <button
                onClick={() => setStep('org')}
                style={{
                  justifySelf: 'start',
                  padding: '10px 16px',
                  background: '#2563eb',
                  color: '#fff',
                  border: '1px solid #1d4ed8',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                Continue as {user.username}
              </button>
            )}
            {popupBlocked && (
              <p style={{ color: '#facc15', margin: 0 }}>
                Pop-up blocked. Allow pop-ups or use “Open GitHub in this tab”.
              </p>
            )}
          </section>
        )}

        {step === 'org' && (
          <section style={{ display: 'grid', gap: 12 }}>
            <label htmlFor="org-select" style={{ fontWeight: 600 }}>
              Choose the GitHub organization to visualize
            </label>
            <select
              id="org-select"
              value={selectedOrg?.login || ''}
              onChange={(e) => {
                const login = e.target.value;
                const found = orgs.find((o) => o.login === login) || null;
                setSelectedOrg(found);
                announce(`${login} selected`);
              }}
              style={{
                padding: '10px 12px',
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: 8,
                minHeight: 44,
              }}
            >
              <option value="">Select an organization…</option>
              {orgs.map((o) => (
                <option key={String(o.id)} value={o.login}>
                  {o.login}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => setStep('install')}
                disabled={!selectedOrg}
                style={{
                  padding: '10px 16px',
                  background: selectedOrg ? '#1f2937' : '#1e293b',
                  color: '#e5e7eb',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  cursor: selectedOrg ? 'pointer' : 'not-allowed',
                  opacity: selectedOrg ? 1 : 0.6,
                }}
              >
                Continue to install
              </button>
              <button
                type="button"
                onClick={() => setStep('demo')}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  color: '#93c5fd',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                View demo instead
              </button>
            </div>
          </section>
        )}

        {step === 'install' && (
          <section style={{ display: 'grid', gap: 12 }}>
            <p>
              Install the GitHub App or grant the required scopes so we can read repos and
              orchestrate workflows. You’ll only need to do this once per organization.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['read:user', 'read:org', 'workflow'].map((s) => (
                <span
                  key={s}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: '#0f172a',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    fontSize: 12,
                  }}
                >
                  {s}
                </span>
              ))}
              <span style={{ color: '#64748b', fontSize: 12 }}>
                Add <code>repo</code> only if you need private repositories.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {getAppInstallUrl() && (
                <button
                  onClick={openInstall}
                  disabled={installing}
                  style={{
                    padding: '10px 16px',
                    background: '#1f2937',
                    color: '#e5e7eb',
                    border: '1px solid #334155',
                    borderRadius: 10,
                    cursor: installing ? 'wait' : 'pointer',
                    minHeight: 44,
                  }}
                >
                  {installing ? 'Waiting for installation…' : 'Open GitHub App install'}
                </button>
              )}
              <a
                href={getAppInstallUrl() ?? 'https://github.com/apps'}
                onClick={() => announce('Opening install in current tab')}
                style={{
                  padding: '10px 16px',
                  background: '#0b1220',
                  color: '#e5e7eb',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 44,
                }}
              >
                Open install in this tab
              </a>
              <button
                onClick={doLogin}
                disabled={installing}
                style={{
                  padding: '10px 16px',
                  background: '#0f172a',
                  color: '#e5e7eb',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  cursor: installing ? 'wait' : 'pointer',
                  minHeight: 44,
                }}
              >
                Re-check OAuth scopes
              </button>
              <button
                onClick={() => setStep('create')}
                disabled={installing}
                style={{
                  padding: '10px 16px',
                  background: '#2563eb',
                  color: '#fff',
                  border: '1px solid #1d4ed8',
                  borderRadius: 10,
                  cursor: installing ? 'wait' : 'pointer',
                  minHeight: 44,
                }}
              >
                Scopes granted — continue
              </button>
            </div>
            {installMsg && <p style={{ color: '#94a3b8', margin: 0 }}>{installMsg}</p>}
            {!getAppInstallUrl() && (
              <p style={{ color: '#64748b', fontSize: 12 }}>
                Tip: set <code>VITE_GITHUB_APP_INSTALL_URL</code> or{' '}
                <code>VITE_GITHUB_APP_SLUG</code> to show a direct install button.
              </p>
            )}
            <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>
              Need help? Review the troubleshooting doc or jump into demo mode while you configure
              scopes.
            </p>
          </section>
        )}

        {step === 'create' && (
          <section style={{ display: 'grid', gap: 12 }}>
            <p>
              Create a village for <strong>{selectedOrg?.login || 'your organization'}</strong>.
              This sets up houses for each repo found during sync.
            </p>
            <button
              onClick={doCreateVillage}
              disabled={busy}
              style={{
                padding: '10px 16px',
                background: '#1f2937',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 10,
                cursor: busy ? 'wait' : 'pointer',
                minHeight: 44,
              }}
            >
              {busy ? 'Creating village…' : 'Create village'}
            </button>
          </section>
        )}

        {step === 'sync' && (
          <section style={{ display: 'grid', gap: 12 }}>
            <p>
              Syncing repositories and building your village layout. This usually takes under a
              minute.
            </p>
            <p style={{ color: '#94a3b8', margin: 0 }}>
              {syncMsg || 'Fetching repository metadata…'}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => setStep('demo')}
                style={{
                  padding: '10px 16px',
                  background: 'transparent',
                  color: '#93c5fd',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                Explore demo while you wait
              </button>
              {createdVillageId && (
                <button
                  onClick={() => {
                    setError('');
                    setSyncMsg('Retrying sync…');
                    doCreateVillage();
                  }}
                  style={{
                    padding: '10px 16px',
                    background: '#0f172a',
                    color: '#e5e7eb',
                    border: '1px solid #334155',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                >
                  Retry sync
                </button>
              )}
            </div>
          </section>
        )}

        {step === 'enter' && (
          <section style={{ display: 'grid', gap: 12 }}>
            <p>Village ready! Jump in whenever you’re ready.</p>
            <button
              onClick={() => createdVillageId && onEnterVillage(createdVillageId)}
              style={{
                padding: '10px 16px',
                background: '#2563eb',
                color: '#fff',
                border: '1px solid #1d4ed8',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Enter village
            </button>
          </section>
        )}

        {step === 'demo' && (
          <section style={{ display: 'grid', gap: 12 }}>
            <p>
              Explore a demo village with mock data. You can return to onboarding anytime from the
              footer.
            </p>
            <button
              onClick={doDemo}
              style={{
                padding: '10px 16px',
                background: '#1f2937',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Enter demo village
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
