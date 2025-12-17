import { Preferences, PreferencesSchema } from './schemas';
import { csrfFetch } from './csrf';

const DEFAULT_PREFS: Preferences = PreferencesSchema.parse({});
const LOCAL_KEY = 'aavm_user_preferences_v1';

function loadLocal(): Preferences {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LOCAL_KEY) : null;
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return PreferencesSchema.parse(parsed);
  } catch {
    return DEFAULT_PREFS;
  }
}

function saveLocal(prefs: Preferences) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors (private mode, quota, etc.)
  }
}

export async function getPreferences(): Promise<Preferences> {
  const cached = loadLocal();
  try {
    const res = await fetch('/api/users/me/preferences', { credentials: 'include' });
    if (res.status === 404) {
      saveLocal(cached);
      return cached;
    }
    if (res.status === 401 || res.status === 403) {
      throw Object.assign(new Error('AUTH_REQUIRED'), { prefs: cached });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const prefs = PreferencesSchema.parse(data);
    saveLocal(prefs);
    return prefs;
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_REQUIRED') throw error;
    if (error instanceof Error && error.message.startsWith('HTTP')) throw error;
    saveLocal(cached);
    return cached;
  }
}

export async function updatePreferences(prefs: Partial<Preferences>): Promise<void> {
  const current = loadLocal();
  const merged = PreferencesSchema.parse({ ...current, ...prefs });
  saveLocal(merged);
  try {
    const res = await csrfFetch('/api/users/me/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    });
    if (res.status === 401 || res.status === 403) throw new Error('AUTH_REQUIRED');
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'AUTH_REQUIRED' || error.message.startsWith('HTTP'))
    )
      throw error;
    // Network failure: rely on local persistence until API is available again.
  }
}
