import React, { useEffect, useState } from 'react';
import { getPreferences, updatePreferences } from '../api/user';
import type { Preferences } from '../api/schemas';

export function SettingsPreferences({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    (async () => {
      try {
        setPrefs(await getPreferences());
      } catch (e: any) {
        setError(e?.message || 'Failed to load preferences');
      }
    })();
  }, [open]);

  async function save(partial: Partial<Preferences>) {
    if (!prefs) return;
    setBusy(true);
    setError(null);
    try {
      const next = { ...prefs, ...partial } as Preferences;
      await updatePreferences(partial);
      setPrefs(next);
      // Apply runtime effects (basic): max FPS cap and theme
      try {
        if (typeof next.maxFps === 'number' && next.maxFps > 0) {
          // Phaser step control is limited; we simulate by throttling RAF via CSS or no-op
          // Placeholder: store in window for scenes to pick up
          (window as any).__MAX_FPS__ = next.maxFps;
        }
        document.documentElement.dataset.theme = next.theme;
      } catch {}
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <div
        style={{
          width: 520,
          maxWidth: '95vw',
          background: '#0b1220',
          border: '1px solid #334155',
          borderRadius: 12,
          padding: 16,
          color: '#e5e7eb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Preferences</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: '#93c5fd',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
        {error && (
          <div
            style={{
              background: '#7f1d1d',
              color: '#fee2e2',
              padding: 8,
              borderRadius: 6,
              marginTop: 8,
            }}
          >
            {error}
          </div>
        )}
        {!prefs ? (
          <p style={{ color: '#94a3b8' }}>Loading…</p>
        ) : (
          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={!!prefs.analytics?.enabled}
                  onChange={(e) => save({ analytics: { enabled: e.target.checked } as any })}
                  disabled={busy}
                />
                &nbsp;Enable analytics (helps improve the app)
              </label>
            </div>
            <div>
              <label>
                LOD Level:&nbsp;
                <select
                  value={prefs.lod}
                  onChange={(e) => save({ lod: e.target.value as any })}
                  disabled={busy}
                >
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </label>
            </div>
            <div>
              <label>
                Max FPS:&nbsp;
                <input
                  type="number"
                  min={30}
                  max={240}
                  value={prefs.maxFps}
                  onChange={(e) => save({ maxFps: Number(e.target.value) })}
                  disabled={busy}
                />
              </label>
            </div>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={!!prefs.colorblind}
                  onChange={(e) => save({ colorblind: e.target.checked })}
                  disabled={busy}
                />
                &nbsp;Colorblind mode
              </label>
            </div>
            <div>
              <label>
                Theme:&nbsp;
                <select
                  value={prefs.theme}
                  onChange={(e) => save({ theme: e.target.value as any })}
                  disabled={busy}
                >
                  <option value="dark">dark</option>
                  <option value="light">light</option>
                </select>
              </label>
            </div>
            <div>
              <label>
                Talk key:&nbsp;
                <input
                  value={prefs.keybindings.talk}
                  onChange={(e) =>
                    save({ keybindings: { ...prefs.keybindings, talk: e.target.value } as any })
                  }
                  disabled={busy}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
