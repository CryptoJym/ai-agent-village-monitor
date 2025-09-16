import type { AnalyticsEvent, AnalyticsBatch } from '@shared/index';

const CONSENT_KEY = 'aavm_analytics_consent_v1';
const CLIENT_ID_KEY = 'aavm_client_id_v1';

function getConsent(): boolean {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    // Opt-in by default until user disables
    return v === null ? true : v === 'true';
  } catch {
    return true;
  }
}
export function setConsent(v: boolean) {
  try {
    localStorage.setItem(CONSENT_KEY, String(v));
  } catch {}
}
function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

const buffer: AnalyticsEvent[] = [];
let flushTimer: number | undefined;

export function track(ev: AnalyticsEvent) {
  if (!getConsent()) return; // respect opt-in/opt-out
  buffer.push(ev);
  scheduleFlush();
}

function scheduleFlush() {
  if (typeof window === 'undefined') return;
  if (flushTimer) return;
  flushTimer = window.setTimeout(() => {
    void flush();
  }, 2000);
}

export async function flush() {
  if (!getConsent()) {
    buffer.length = 0;
    return;
  }
  const batch: AnalyticsBatch = {
    events: buffer.splice(0, buffer.length),
    clientId: getClientId(),
    consent: true,
  };
  if (batch.events.length === 0) return;
  try {
    await fetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(batch),
    });
  } catch {
    // ignore and retry later; rebuffer
    buffer.unshift(...batch.events);
  } finally {
    flushTimer = undefined;
  }
}
