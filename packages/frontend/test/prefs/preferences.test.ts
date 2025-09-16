import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreferencesSchema } from '../../src/api/schemas';
import { getPreferences, updatePreferences } from '../../src/api/user';

describe('preferences', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses preferences and applies defaults', async () => {
    const payload = { lod: 'medium', maxFps: 75 };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    const prefs = await getPreferences();
    expect(prefs.lod).toBe('medium');
    expect(prefs.maxFps).toBe(75);
    // Defaults for unspecified
    expect(prefs.theme).toBeDefined();
    expect(typeof prefs.colorblind).toBe('boolean');
  });

  it('updatePreferences issues PUT with JSON body', async () => {
    const spy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    global.fetch = spy as any;
    await updatePreferences({ theme: 'light', colorblind: true });
    expect(spy).toHaveBeenCalled();
    const args = spy.mock.calls[0];
    expect(args[0]).toContain('/api/users/me/preferences');
    expect(args[1].method).toBe('PUT');
    const body = JSON.parse(args[1].body);
    expect(body.theme).toBe('light');
    expect(body.colorblind).toBe(true);
  });
});
