import { Preferences, PreferencesSchema } from './schemas';

export async function getPreferences(): Promise<Preferences> {
  const res = await fetch('/api/users/me/preferences', { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return PreferencesSchema.parse(data);
}

export async function updatePreferences(prefs: Partial<Preferences>): Promise<void> {
  const res = await fetch('/api/users/me/preferences', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
