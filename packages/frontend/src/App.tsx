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
import { ErrorBoundary } from './ui/ErrorBoundary';
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
      // reset source after logging to avoid stale attribution
      lastOpenSourceRef.current = 'unknown';
    }
  }, [panelOpen, villageId]);
  return (
    <ToastProvider>
      <EventToastBridge />
      <GlobalErrorHooks />
      <div
        style={{
          color: highContrast ? '#ffffff' : '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          background: highContrast ? '#000' : undefined,
        }}
      >
        <OfflineBanner />
        <h1>AI Agent Village Monitor</h1>
        <LocaleSwitcher />
        {villageId && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <RoleBadge role={viewerRole} />
          </div>
        )}
        <p>Loaded at: {nowIso()}</p>
        <div style={{ position: 'relative' }}>
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
            <ErrorBoundary>
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
            // Lightweight admin widget for sync health; endpoint enforces access
            <Suspense fallback={null}>
              <SyncHealth villageId={villageId} />
            </Suspense>
          )}
          {villageId && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              style={{
                position: 'absolute',
                right: 12,
                top: 12,
                padding: '8px 12px',
                background: '#1f2937',
                color: '#e5e7eb',
                border: '1px solid #374151',
                borderRadius: 8,
                cursor: viewerRole === 'owner' ? 'pointer' : 'not-allowed',
                opacity: viewerRole === 'owner' ? 1 : 0.6,
              }}
              disabled={viewerRole !== 'owner'}
            >
              Settings
            </button>
          )}
          {villageId && viewerRole === 'owner' && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch(`/api/villages/${encodeURIComponent(villageId)}/layout/reset`, {
                    method: 'POST',
                    credentials: 'include',
                  });
                } catch (e) {
                  void e;
                }
              }}
              style={{
                position: 'absolute',
                right: 100,
                top: 12,
                padding: '8px 12px',
                background: '#0b1220',
                color: '#e5e7eb',
                border: '1px solid #334155',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Reset Layout
            </button>
          )}
          {villageId && viewerRole === 'owner' && (
            <Suspense fallback={null}>
              <FastTravelMetrics />
            </Suspense>
          )}
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            style={{
              position: 'absolute',
              right: villageId ? 180 : 92,
              top: 12,
              padding: '8px 12px',
              background: '#0b1220',
              color: '#e5e7eb',
              border: '1px solid #334155',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Feedback
          </button>
          <Suspense fallback={null}>
            <HelpMenu
              onOpenFeedback={() => setFeedbackOpen(true)}
              onOpenLegend={() => setHelpOpen(true)}
            />
          </Suspense>
          <Suspense fallback={null}>
            <HelpHint onOpen={() => setHelpOpen(true)} />
          </Suspense>
          <HouseDashboardPanel
            open={houseDashboard != null}
            data={houseDashboard}
            onClose={() => setHouseDashboard(null)}
            viewerRole={viewerRole}
          />
          <button
            type="button"
            onClick={() => {
              // attribute opening via button
              if (!panelOpen) lastOpenSourceRef.current = 'button';
              setPanelOpen((v) => !v);
            }}
            style={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              padding: '8px 12px',
              background: '#1f2937',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            {panelOpen ? 'Close' : 'Dialogue'}
          </button>
          <button
            type="button"
            onClick={() => setHighContrast((v) => !v)}
            style={{
              position: 'absolute',
              left: 12,
              top: 12,
              padding: '6px 10px',
              background: '#0b1220',
              color: '#e5e7eb',
              border: '1px solid #334155',
              borderRadius: 8,
              cursor: 'pointer',
            }}
            aria-pressed={highContrast}
            aria-label="Toggle high contrast mode (H)"
          >
            {highContrast ? 'High Contrast: On' : 'High Contrast: Off'}
          </button>
          <button
            type="button"
            onClick={() => setOnboardingOpen(true)}
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              padding: '8px 12px',
              background: '#1f2937',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Onboard
          </button>
          <button
            type="button"
            onClick={() => setPrefsOpen(true)}
            style={{
              position: 'absolute',
              left: 12,
              top: 52,
              padding: '8px 12px',
              background: '#1f2937',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Preferences
          </button>
          <OnboardingStepper
            open={onboardingOpen}
            onClose={() => setOnboardingOpen(false)}
            onEnterVillage={(villageId) => {
              // Switch to the MainScene with village, close overlay
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
        <DialogueUI
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          agentId={selectedAgent}
          initialTab={dialogueTab}
          onTabChange={(t) => setDialogueTab(t)}
        />
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
