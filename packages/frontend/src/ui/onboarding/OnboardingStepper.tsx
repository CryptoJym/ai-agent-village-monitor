import React, { useEffect, useMemo, useRef, useState } from 'react';

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
  const timings = useRef<{ [k in StepKey]?: number }>({});
  const startedAt = useRef<number>(Date.now());

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
    // Best-effort beacon (optional)
    try {
      const blob = new Blob([JSON.stringify({ type: 'onboarding_timings', data })], {
        type: 'application/json',
      });
      // This endpoint may not exist; it's OK if it fails silently
      navigator.sendBeacon?.('/analytics', blob);
    } catch (e) {
      void e;
    }
    // Always log to console for dev visibility

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

  function doLogin() {
    setError('');
    // Open GitHub OAuth in a popup and poll /auth/me until authenticated
    const w = window.open('/auth/login', 'gh_login', 'width=680,height=760,noopener');
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
        return;
      }
      // Cancelled by closing popup
      if (!w || w.closed) {
        setError('Login cancelled. You can try again.');
        return;
      }
      // Timeout after ~60s
      if (Date.now() - start > 60_000) {
        setError('Login timed out. Please try again.');
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
    // Prefer explicit install URL; otherwise build from app slug if provided
    const env: any =
      (import.meta as unknown as { env?: Record<string, string> })?.env || ({} as any);
    const url = env.VITE_GITHUB_APP_INSTALL_URL as string | undefined;
    if (url && /^https?:\/\//.test(url)) return url;
    const slug = env.VITE_GITHUB_APP_SLUG as string | undefined;
    if (slug && slug.trim()) return `https://github.com/apps/${slug.trim()}/installations/new`;
    return null;
  }

  async function verifyScopesAndInstall(): Promise<boolean> {
    // Basic check: can we list orgs with current session? If yes, required read:org is present.
    // If this fails due to network or missing backend, treat as inconclusive.
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
    setInstalling(true);
    let w: Window | null = null;
    if (url) {
      try {
        w = window.open(url, 'gh_install', 'width=980,height=840,noopener');
      } catch (e) {
        void e;
      }
    }
    const start = Date.now();
    const tick = async () => {
      // If user closed the window, we still keep polling for a short while
      const ok = await verifyScopesAndInstall();
      if (ok) {
        setInstallMsg('Installation detected. Continuing…');
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
          'We could not confirm the install/scopes. You can try again, grant scopes via OAuth, or continue anyway.',
        );
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
      const res = await fetch('/api/villages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
      // kick off background sync and then enter
      try {
        await fetch(`/api/villages/${encodeURIComponent(vid)}/houses/sync`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch (e) {
        void e;
      }
      // Poll status until lastSynced present or timeout
      const start = Date.now();
      const poll = async () => {
        try {
          setSyncMsg('Syncing repositories…');
          const r = await fetch(`/api/villages/${encodeURIComponent(vid)}`, {
            credentials: 'include',
          });
          if (r.ok) {
            const j = await r.json();
            if (j?.lastSynced) {
              setStep('enter');
              reportTimings('success');
              onEnterVillage(vid);
              return;
            }
          }
        } catch (e) {
          void e;
        }
        if (Date.now() - start > 60_000) {
          setError('Sync timed out. You can retry or continue to demo.');
          setSyncMsg('');
          return;
        }
        setTimeout(poll, 1000);
      };
      setTimeout(poll, 1200);
    } catch (e: any) {
      // Fallback to demo mode when API is missing or unauthorized
      setError('Create failed, switching to demo mode.');
      setStep('demo');
    } finally {
      setBusy(false);
    }
  }

  function doDemo() {
    // generate a mock village id and enter
    reportTimings('demo');
    onEnterVillage('demo');
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(2,8,23,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          width: 680,
          maxWidth: '96%',
          background: '#0b1220',
          border: '1px solid #1f2a3a',
          borderRadius: 12,
          padding: 16,
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Onboarding</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <ol
          style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, margin: '8px 0 12px 0' }}
        >
          {steps.map((s, i) => (
            <li key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: s.key === step ? '#1f2937' : '#0f172a',
                  border: '1px solid #334155',
                }}
              >
                {i + 1}. {s.title}
              </span>
              {i < steps.length - 1 && <span style={{ color: '#475569' }}>→</span>}
            </li>
          ))}
        </ol>

        {error && (
          <div style={{ color: '#fca5a5', marginBottom: 8 }}>
            {error}
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  setError('');
                  /* simple retry: reload current step */ if (step === 'org') {
                    (async () => setOrgs(await fetchOrgs()))();
                  }
                  if (step === 'create') {
                    /* no-op */
                  }
                }}
                style={{ padding: '6px 10px' }}
              >
                Retry
              </button>
              <button onClick={() => setStep('login')} style={{ padding: '6px 10px' }}>
                Back to Login
              </button>
            </div>
          </div>
        )}

        {/* Step content */}
        {step === 'login' && (
          <div>
            <p>Sign in with GitHub to continue.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={doLogin}
                style={{
                  padding: '8px 12px',
                  background: '#1f2937',
                  color: '#e5e7eb',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Login with GitHub
              </button>
              {user && (
                <button
                  onClick={() => setStep('org')}
                  style={{
                    padding: '8px 12px',
                    background: '#2563eb',
                    color: '#fff',
                    border: '1px solid #1d4ed8',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  Continue as {user.username}
                </button>
              )}
              <button
                onClick={() => {
                  setStep('demo');
                }}
                style={{
                  padding: '8px 12px',
                  background: '#0f172a',
                  color: '#e5e7eb',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Try Demo
              </button>
            </div>
          </div>
        )}

        {step === 'org' && (
          <div>
            <p>Select your organization.</p>
            <select
              value={selectedOrg?.login || ''}
              onChange={(e) => {
                const login = e.target.value;
                const found = orgs.find((o) => o.login === login) || null;
                setSelectedOrg(found);
              }}
              style={{
                padding: 8,
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: 6,
              }}
            >
              <option value="">Choose…</option>
              {orgs.map((o) => (
                <option key={String(o.id)} value={o.login}>
                  {o.login}
                </option>
              ))}
            </select>
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => setStep('install')}
                disabled={!selectedOrg}
                style={{
                  padding: '8px 12px',
                  background: '#1f2937',
                  color: '#e5e7eb',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'install' && (
          <div>
            <p>
              Install the GitHub App or grant OAuth scopes for repository visibility and workflow
              control.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
              {['read:user', 'read:org', 'workflow'].map((s) => (
                <span
                  key={s}
                  style={{
                    padding: '4px 8px',
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
                (add &apos;repo&apos; only if private repos are required)
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {getAppInstallUrl() && (
                <button
                  onClick={openInstall}
                  disabled={installing}
                  style={{
                    padding: '8px 12px',
                    background: '#1f2937',
                    color: '#e5e7eb',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  {installing ? 'Waiting…' : 'Open GitHub App Installation'}
                </button>
              )}
              <button
                onClick={doLogin}
                disabled={installing}
                style={{
                  padding: '8px 12px',
                  background: '#0f172a',
                  color: '#e5e7eb',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Grant Scopes via OAuth
              </button>
              <button
                onClick={() => setStep('create')}
                disabled={installing}
                style={{
                  padding: '8px 12px',
                  background: '#2563eb',
                  color: '#fff',
                  border: '1px solid #1d4ed8',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                I’ve granted scopes
              </button>
            </div>
            {installMsg && (
              <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>{installMsg}</p>
            )}
            {!getAppInstallUrl() && (
              <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
                Tip: set VITE_GITHUB_APP_INSTALL_URL or VITE_GITHUB_APP_SLUG to show a direct
                &quot;Open Installation&quot; button.
              </p>
            )}
            <p style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
              Having trouble? See troubleshooting in README or try{' '}
              <button
                onClick={() => setStep('demo')}
                style={{
                  color: '#93c5fd',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Demo Mode
              </button>
              .
            </p>
          </div>
        )}

        {step === 'create' && (
          <div>
            <p>
              Create a village for <strong>{selectedOrg?.login || 'your org'}</strong>.
            </p>
            <button
              onClick={doCreateVillage}
              disabled={busy}
              style={{
                padding: '8px 12px',
                background: '#1f2937',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {busy ? 'Creating…' : 'Create Village'}
            </button>
          </div>
        )}

        {step === 'sync' && (
          <div>
            <p>Syncing repositories and building your village layout…</p>
            <p style={{ color: '#94a3b8' }}>{syncMsg || 'This usually takes about a minute.'}</p>
            {error && createdVillageId && (
              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => {
                    setError('');
                    const vid = createdVillageId;
                    const start = Date.now();
                    const poll = async () => {
                      try {
                        setSyncMsg('Retrying…');
                        const r = await fetch(`/api/villages/${encodeURIComponent(vid)}`, {
                          credentials: 'include',
                        });
                        if (r.ok) {
                          const j = await r.json();
                          if (j?.lastSynced) {
                            setStep('enter');
                            reportTimings('success');
                            onEnterVillage(vid);
                            return;
                          }
                        }
                      } catch {}
                      if (Date.now() - start > 60_000) {
                        setError('Sync timed out again. You can try demo mode.');
                        setSyncMsg('');
                        return;
                      }
                      setTimeout(poll, 1000);
                    };
                    setTimeout(poll, 600);
                  }}
                  style={{
                    padding: '8px 12px',
                    background: '#0f172a',
                    color: '#e5e7eb',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'enter' && (
          <div>
            <p>Village ready. Entering now…</p>
          </div>
        )}

        {step === 'demo' && (
          <div>
            <p>Explore a demo village with mock data.</p>
            <button
              onClick={doDemo}
              style={{
                padding: '8px 12px',
                background: '#1f2937',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Enter Demo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
