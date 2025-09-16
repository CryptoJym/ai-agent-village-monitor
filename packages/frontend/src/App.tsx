import { useEffect, useState } from 'react';
import { nowIso } from '@shared/index';
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
import { SettingsPermissions } from './ui/SettingsPermissions';
import { FeedbackModal } from './ui/FeedbackModal';
import { SettingsPreferences } from './ui/SettingsPreferences';
import { track } from './analytics/client';
import { PerformanceOverlay } from './ui/PerformanceOverlay';
import { LocaleSwitcher } from './ui/LocaleSwitcher';

import { EventToastBridge } from './ui/EventToastBridge';
import { EngineBadge } from './ui/EngineBadge';
import { initSentry } from './observability/sentry';

export default function App() {
  try {
    initSentry();
  } catch {}
  const params = useParams();
  const villageId = params.id as string | undefined;
  const [panelOpen, setPanelOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [viewerRole, setViewerRole] = useState<'owner' | 'member' | 'visitor' | 'none'>('none');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  // High contrast mode
  const [highContrast, setHighContrast] = useState(false);

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

  // Global shortcuts: T opens dialogue, Esc handled inside components
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setPanelOpen(true);
      }
      if (e.key.toLowerCase() === 'h') {
        // Toggle high contrast for accessibility
        setHighContrast((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Track app mount as session_start and first village view when known
  useEffect(() => {
    track({ type: 'session_start', ts: Date.now() });
    return () => {
      track({ type: 'session_end', ts: Date.now(), durationMs: 0 });
    };
  }, []);
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
                try {
                   
                  const { PreloaderScene } = require('./scenes/PreloaderScene');
                   
                  const { WorldMapScene } = require('./scenes/WorldMapScene');
                   
                  const { MainScene } = require('./scenes/MainScene');
                  return [PreloaderScene, WorldMapScene, MainScene];
                } catch {
                  return [];
                }
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
          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            style={{
              position: 'absolute',
              right: villageId ? 100 : 12,
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
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
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
              top: 12,
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
              } catch {}
              setOnboardingOpen(false);
            }}
          />
        </div>
        <DialogueUI open={panelOpen} onClose={() => setPanelOpen(false)} />
        <SettingsPermissions
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          villageId={villageId}
        />
        <SettingsPreferences open={prefsOpen} onClose={() => setPrefsOpen(false)} />
        <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      </div>
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
