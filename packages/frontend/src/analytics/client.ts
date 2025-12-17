import type { AnalyticsEvent, AnalyticsBatch } from '@shared';
import { csrfFetch } from '../api/csrf';

const CONSENT_KEY = 'aavm_analytics_consent_v1';
const CLIENT_ID_KEY = 'aavm_client_id_v1';

function hasDntGpc(): boolean {
  try {
    const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
    const win: any = typeof window !== 'undefined' ? window : undefined;
    const dnt =
      nav?.doNotTrack === '1' ||
      nav?.doNotTrack === 'yes' ||
      win?.doNotTrack === '1' ||
      nav?.msDoNotTrack === '1';
    const gpc = !!(nav && 'globalPrivacyControl' in nav && nav.globalPrivacyControl);
    return !!(dnt || gpc);
  } catch {
    return false;
  }
}

function getConsent(): boolean {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    const local = v === 'true';
    if (hasDntGpc()) return false;
    return local;
  } catch {
    return false;
  }
}
export function setConsent(v: boolean) {
  try {
    localStorage.setItem(CONSENT_KEY, String(v));
  } catch (e) {
    void e;
  }
}
export function hasStoredConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) !== null;
  } catch {
    return false;
  }
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
    await csrfFetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
  } catch {
    // ignore and retry later; rebuffer
    buffer.unshift(...batch.events);
  } finally {
    flushTimer = undefined;
  }
}

// Flush immediately using sendBeacon (best-effort during unload/visibility changes)
export function flushBeacon() {
  try {
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
    void csrfFetch('/api/analytics/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      keepalive: true,
    }).catch(() => {
      // swallow
    });
  } catch {
    // swallow
  } finally {
    flushTimer = undefined;
  }
}
