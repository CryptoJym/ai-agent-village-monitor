import { Suspense, useEffect, useRef, useState } from 'react';
import { nowIso } from '@shared';
import { useParams } from 'react-router-dom';
// Scenes loaded lazily to avoid importing Phaser in tests
import { DialogueUI } from './ui/DialogueUI';
import { OnboardingStepper } from './ui/onboarding/OnboardingStepper';
import { ToastProvider } from './ui/Toast';
import { OfflineBanner } from './ui/OfflineBanner';
import { GlobalErrorHooks } from './ui/GlobalErrorHooks';
import { ConnectionOverlay } from './ui/ConnectionOverlay';
import { ErrorBoundary, InlineErrorBoundary } from './ui/ErrorBoundary';
import { GameCanvas, GameProvider } from './game';
import { PreloaderScene } from './scenes/PreloaderScene';
import { WorldMapScene } from './scenes/WorldMapScene';
import { MainScene } from './scenes/MainScene';
import { InteriorScene } from './scenes/InteriorScene';
import { track, flushBeacon } from './analytics/client';
import { readUIHash, writeUIHash, onHashChange, type UIHashState } from './state/uiState';
import { eventBus } from './realtime/EventBus';
import * as perf from './metrics/perf';
import { PerformanceOverlay } from './ui/PerformanceOverlay';
import { LocaleSwitcher } from './ui/LocaleSwitcher';
import { EventToastBridge } from './ui/EventToastBridge';
import { EngineBadge } from './ui/EngineBadge';
import { initSentry } from './observability/sentry';
import { AnalyticsConsentBanner } from './ui/AnalyticsConsentBanner';
import { HouseDashboardPanel, type HouseDashboardData } from './ui/HouseDashboardPanel';
import { SettingsPermissions } from './ui/SettingsPermissions';
import { SettingsPreferences } from './ui/SettingsPreferences';
import { FeedbackModal } from './ui/FeedbackModal';
import { LegendOverlay } from './ui/LegendOverlay';
import { SyncHealth } from './ui/SyncHealth';
import { FastTravelMetrics } from './ui/FastTravelMetrics';
import { HelpMenu } from './ui/HelpMenu';
import { HelpHint } from './ui/HelpHint';
import { CommandPalette } from './ui/CommandPalette';
import { UserMenu } from './components/auth/UserMenu';
import { RunnerSessionPanel } from './components/dev/RunnerSessionPanel';

export default function App() {
  try {
    initSentry();
  } catch (e) {
    void e;
  }
  const params = useParams();
  const villageId = params.id as string | undefined;
  const [panelOpen, setPanelOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('agent-placeholder');
  const [dialogueTab, setDialogueTab] = useState<'thread' | 'control' | 'info'>('thread');
  const [viewerRole, setViewerRole] = useState<'owner' | 'member' | 'visitor' | 'none'>('none');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [houseDashboard, setHouseDashboard] = useState<HouseDashboardData | null>(null);
  // High contrast mode
  const [highContrast, setHighContrast] = useState(false);
  const sessionStartRef = useRef<number | null>(null);
  const lastOpenSourceRef = useRef<'button' | 'shortcut' | 'unknown'>('unknown');

  useEffect(() => {
    // Hydrate UI state from URL hash on mount and on hash changes
    const applyFromHash = () => {
      const h: UIHashState = readUIHash();
      if (h.agent) setSelectedAgent(h.agent);
      if (h.tab) setDialogueTab(h.tab);
    };
    applyFromHash();
    const off = onHashChange(() => applyFromHash());
    return () => off();
  }, []);

  useEffect(() => {
    const onIdentity = (p: { agentId: string; name?: string }) => setSelectedAgent(p.agentId);
    eventBus.on('agent_identity', onIdentity);
    return () => eventBus.off('agent_identity', onIdentity);
  }, []);

  useEffect(() => {
    const onDashboard = (payload: HouseDashboardData) => setHouseDashboard(payload);
    eventBus.on('house_dashboard', onDashboard);
    return () => eventBus.off('house_dashboard', onDashboard);
  }, []);

  useEffect(() => {
    if (!houseDashboard?.houseId) return;
    if (houseDashboard.metrics) return;
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/internal/kpi/houses?houseId=${encodeURIComponent(houseDashboard.houseId)}`,
          { credentials: 'include' },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (ignore) return;
        if (data?.house) {
          setHouseDashboard((prev) =>
            prev && prev.houseId === houseDashboard.houseId
              ? { ...prev, metrics: data.house }
              : prev,
          );
        }
      } catch (e) {
        void e;
      }
    })();
    return () => {
      ignore = true;
    };
  }, [houseDashboard?.houseId, houseDashboard?.metrics]);

  // Keep URL hash in sync with camera on cameraSettled
  useEffect(() => {
    const onSettle = (p: { x: number; y: number; zoom: number }) => {
      writeUIHash({
        cam: { x: Math.round(p.x), y: Math.round(p.y), z: Number(p.zoom.toFixed(2)) },
      });
      perf.endTravel();
    };
    eventBus.on('cameraSettled', onSettle);
    return () => eventBus.off('cameraSettled', onSettle as any);
  }, []);

  // Keep URL hash in sync when selected agent or tab changes
  useEffect(() => {
    writeUIHash({ agent: selectedAgent, tab: dialogueTab });
  }, [selectedAgent, dialogueTab]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!villageId) {
        setViewerRole('none');
        return;
      }
      try {
        const res = await fetch(`/api/villages/${encodeURIComponent(villageId)}`, {
          credentials: 'include',
        });
        const j = await res.json();
        if (!ignore) setViewerRole(j?.viewerRole || (j?.isPublic ? 'visitor' : 'none'));
      } catch {
        if (!ignore) setViewerRole('none');
      }
    })();
    return () => {
      ignore = true;
    };
  }, [villageId]);

  // Global shortcuts: T opens dialogue, H toggles contrast, '?' shows legend
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const isEditable =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox';
        if (isEditable) return;
      }
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        lastOpenSourceRef.current = 'shortcut';
        setPanelOpen(true);
      }
      if (e.key.toLowerCase() === 'h') {
        // Toggle high contrast for accessibility
        setHighContrast((v) => !v);
      }
      if (e.key === '?' || (e.key === '/' && e.shiftKey) || e.key === 'F1') {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [villageId]);

  // Mark legend as seen when opened (enables subtle '?' hint next to Help)
  useEffect(() => {
    if (helpOpen) {
      try {
        localStorage.setItem('help_hint_seen_v1', '1');
      } catch {
        // ignore storage failures
      }
    }
  }, [helpOpen]);

  // Track app mount as session_start and first village view when known
  useEffect(() => {
    const start = Date.now();
    sessionStartRef.current = start;
    track({ type: 'session_start', ts: start });
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        const end = Date.now();
        const durationMs = sessionStartRef.current ? end - sessionStartRef.current : 0;
        track({ type: 'session_end', ts: end, durationMs, villageId });
        flushBeacon();
        // Start a new session on next visibility change back to visible
        sessionStartRef.current = Date.now();
        track({ type: 'session_start', ts: sessionStartRef.current });
      }
    };
    const onPageHide = () => {
      const end = Date.now();
      const durationMs = sessionStartRef.current ? end - sessionStartRef.current : 0;
      track({ type: 'session_end', ts: end, durationMs, villageId });
      flushBeacon();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      const end = Date.now();
      const durationMs = sessionStartRef.current ? end - sessionStartRef.current : 0;
      track({ type: 'session_end', ts: end, durationMs, villageId });
    };
  }, [villageId]);

  // Track village view on route entry (debounced to avoid flicker double-counts)
  useEffect(() => {
    if (!villageId) return;
    const t = window.setTimeout(() => {
      track({ type: 'village_view', ts: Date.now(), villageId });
    }, 750);
    return () => window.clearTimeout(t);
  }, [villageId]);

  // Track dialogue open
  useEffect(() => {
    if (panelOpen) {
      track({
        type: 'dialogue_open',
        ts: Date.now(),
        source: lastOpenSourceRef.current,
        villageId,
      });
      lastOpenSourceRef.current = 'unknown';
    }
  }, [panelOpen, villageId]);

  const resetTimerRef = useRef<number | null>(null);
  const [resetDeadline, setResetDeadline] = useState<number | null>(null);
  const [resetCountdown, setResetCountdown] = useState<number>(0);

  useEffect(() => {
    if (!resetDeadline) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((resetDeadline - Date.now()) / 1000));
      setResetCountdown(remaining);
      if (remaining <= 0) {
        setResetDeadline(null);
      }
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [resetDeadline]);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    };
  }, []);

  const cancelScheduledReset = () => {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setResetDeadline(null);
    setResetCountdown(0);
    eventBus.emit('toast', { type: 'info', message: 'Layout reset cancelled.' });
  };

  const performLayoutReset = async () => {
    if (!villageId) return;
    try {
      await fetch(`/api/villages/${encodeURIComponent(villageId)}/layout/reset`, {
        method: 'POST',
        credentials: 'include',
      });
      eventBus.emit('toast', {
        type: 'success',
        message: 'Layout reset. Houses return to default positions.',
      });
      track({ type: 'layout_reset', ts: Date.now(), villageId });
    } catch (err) {
      eventBus.emit('toast', {
        type: 'error',
        message: 'Reset failed. Please try again or check your connection.',
      });
      void err;
    } finally {
      setResetDeadline(null);
      setResetCountdown(0);
      resetTimerRef.current = null;
    }
  };

  const scheduleLayoutReset = () => {
    if (!villageId || viewerRole !== 'owner') return;
    const confirmed = window.confirm(
      'Reset the village layout? This will move all houses back to their default positions.',
    );
    if (!confirmed) return;
    const deadline = Date.now() + 5000;
    setResetDeadline(deadline);
    eventBus.emit('toast', {
      type: 'info',
      message: 'Layout reset in 5 seconds. Select "Undo" to keep current placement.',
    });
    if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => {
      void performLayoutReset();
    }, 5000);
  };

  return (
    <ToastProvider>
      <EventToastBridge />
      <GlobalErrorHooks />
      <a href="#accessible-dashboard" className="skip-link">
        Skip to accessible dashboard view
      </a>
      <div
        style={{
          color: highContrast ? '#ffffff' : '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          background: highContrast ? '#000' : undefined,
          padding: 'var(--space-md)',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        <OfflineBanner />
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-sm)',
            alignItems: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 'var(--font-title)' }}>AI Agent Village Monitor</h1>
          <LocaleSwitcher />
          {villageId && <RoleBadge role={viewerRole} />}
          <span aria-live="polite" style={{ marginLeft: 'auto', color: '#94a3b8' }}>
            Loaded at: {nowIso()}
          </span>
          <UserMenu />
        </header>
        <div style={{ position: 'relative', marginTop: 'var(--space-md)' }}>
          <GameProvider
            config={{
              type: 0 as any,
              width: 800,
              height: 450,
              backgroundColor: '#0f172a',
              scene: ((): any[] => {
                const isJsdom =
                  typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
                if (isJsdom) return [];
                return [PreloaderScene, WorldMapScene, MainScene, InteriorScene];
              })(),
            }}
          >
            <ErrorBoundary name="GameCanvas">
              <GameCanvas />
            </ErrorBoundary>
          </GameProvider>
          <ConnectionOverlay />
          <PerformanceOverlay />
          <EngineBadge />
          <Suspense fallback={null}>
            <LegendOverlay open={legendOpen} onClose={() => setLegendOpen(false)} />
          </Suspense>
          {villageId && viewerRole === 'owner' && (
            <Suspense fallback={null}>
              <SyncHealth villageId={villageId} />
            </Suspense>
          )}
          {villageId && viewerRole === 'owner' && (
            <Suspense fallback={null}>
              <FastTravelMetrics />
            </Suspense>
          )}
          <div className="control-cluster">
            {villageId && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                disabled={viewerRole !== 'owner'}
                style={{
                  padding: '10px 16px',
                  background: '#1f2937',
                  color: '#e5e7eb',
                  border: '1px solid #374151',
                  borderRadius: 10,
                  cursor: viewerRole === 'owner' ? 'pointer' : 'not-allowed',
                  opacity: viewerRole === 'owner' ? 1 : 0.6,
                }}
              >
                Settings
              </button>
            )}
            {villageId && viewerRole === 'owner' && !resetDeadline && (
              <button
                type="button"
                onClick={scheduleLayoutReset}
                style={{
                  padding: '10px 16px',
                  background: '#0b1220',
                  color: '#e5e7eb',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                Reset layout
              </button>
            )}
            {resetDeadline && (
              <button
                type="button"
                onClick={cancelScheduledReset}
                style={{
                  padding: '10px 16px',
                  background: '#f97316',
                  color: '#0f172a',
                  border: '1px solid #fb923c',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                Undo reset ({resetCountdown}s)
              </button>
            )}
            <button
              type="button"
              onClick={() => setFeedbackOpen(true)}
              style={{
                padding: '10px 16px',
                background: '#0b1220',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Feedback
            </button>
            <Suspense fallback={null}>
              <HelpMenu
                style={{ marginTop: 'var(--space-xs)' }}
                onOpenFeedback={() => setFeedbackOpen(true)}
                onOpenLegend={() => setHelpOpen(true)}
              />
            </Suspense>
          </div>
          <div className="control-cluster control-cluster--left">
            <button
              type="button"
              onClick={() => setHighContrast((v) => !v)}
              aria-pressed={highContrast}
              aria-label="Toggle high contrast mode (H)"
              style={{
                padding: '10px 16px',
                background: '#0b1220',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              {highContrast ? 'High contrast on' : 'High contrast off'}
            </button>
            <button
              type="button"
              onClick={() => setPrefsOpen(true)}
              style={{
                padding: '10px 16px',
                background: '#1f2937',
                color: '#e5e7eb',
                border: '1px solid #374151',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Preferences
            </button>
            <button
              type="button"
              onClick={() => setOnboardingOpen(true)}
              style={{
                padding: '10px 16px',
                background: '#2563eb',
                color: '#fff',
                border: '1px solid #1d4ed8',
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              Onboarding
            </button>
          </div>
          <Suspense fallback={null}>
            <HelpHint onOpen={() => setHelpOpen(true)} />
          </Suspense>
          <ErrorBoundary name="HouseDashboard">
            <HouseDashboardPanel
              open={houseDashboard != null}
              data={houseDashboard}
              onClose={() => setHouseDashboard(null)}
              viewerRole={viewerRole}
            />
          </ErrorBoundary>
          <OnboardingStepper
            open={onboardingOpen}
            onClose={() => setOnboardingOpen(false)}
            onEnterVillage={(villageId) => {
              try {
                const game = (document.querySelector('canvas') as any)?._phaserGame || null;
                if (game) {
                  const scene = game.scene.getScene('MainScene');
                  if (scene) scene.scene.start('MainScene', { villageId });
                }
              } catch (e) {
                void e;
              }
              setOnboardingOpen(false);
            }}
          />
        </div>
        <div
          style={{
            marginTop: 'var(--space-md)',
            display: 'flex',
            gap: 'var(--space-sm)',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            aria-label="Dialogue"
            aria-expanded={panelOpen}
            onClick={() => {
              if (!panelOpen) lastOpenSourceRef.current = 'button';
              setPanelOpen((v) => !v);
            }}
            style={{
              padding: '10px 16px',
              background: '#1f2937',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            {panelOpen ? 'Hide dialogue' : 'Open dialogue'}
          </button>
        </div>
        <details id="accessible-dashboard" className="accessible-dashboard">
          <summary>Accessible dashboard view</summary>
          <div>
            <p>Selected agent: {selectedAgent || 'None selected'}</p>
            {houseDashboard ? (
              <dl>
                <dt>House</dt>
                <dd>{houseDashboard.name}</dd>
                {houseDashboard.metrics && (
                  <>
                    <dt>Commands (24h)</dt>
                    <dd>{houseDashboard.metrics.commands}</dd>
                    <dt>Error rate</dt>
                    <dd>{Math.round((houseDashboard.metrics.errorRate || 0) * 100)}%</dd>
                  </>
                )}
              </dl>
            ) : (
              <p>
                No house selected. Click a house in the world or open the dialogue to choose an
                agent.
              </p>
            )}
            <p>
              Keyboard tip: press T to open the dialogue, ? for controls, H for high contrast, and
              Esc to close overlays.
            </p>
          </div>
        </details>
        <ErrorBoundary name="DialogueUI">
          <DialogueUI
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            agentId={selectedAgent}
            initialTab={dialogueTab}
            onTabChange={(t) => setDialogueTab(t)}
          />
        </ErrorBoundary>
        <Suspense fallback={null}>
          <SettingsPermissions
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            villageId={villageId}
          />
        </Suspense>
        <Suspense fallback={null}>
          <SettingsPreferences open={prefsOpen} onClose={() => setPrefsOpen(false)} />
        </Suspense>
        <Suspense fallback={null}>
          <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </Suspense>
        <Suspense fallback={null}>
          <LegendOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
        </Suspense>
        {/* Global command palette overlay (Ctrl/Cmd+K) */}
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
        {/* Dev-only runner session panel */}
        {import.meta.env.VITE_DEV_RUNNER_PANEL === 'true' && (
          <Suspense fallback={null}>
            <RunnerSessionPanel />
          </Suspense>
        )}
      </div>
      <AnalyticsConsentBanner />
    </ToastProvider>
  );
}

function RoleBadge({ role }: { role: 'owner' | 'member' | 'visitor' | 'none' }) {
  const map: Record<string, { bg: string; fg: string }> = {
    owner: { bg: '#0ea5e9', fg: '#082f49' },
    member: { bg: '#10b981', fg: '#064e3b' },
    visitor: { bg: '#f59e0b', fg: '#422006' },
    none: { bg: '#64748b', fg: '#0f172a' },
  };
  const { bg, fg } = map[role] || map.none;
  const label = role === 'none' ? 'no access' : role;
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: 12,
        border: '1px solid #1f2937',
      }}
    >
      {label}
    </span>
  );
}
