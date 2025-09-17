export function initSentry() {
  try {
    const dsn = (import.meta as any)?.env?.VITE_SENTRY_DSN as string | undefined;
    if (!dsn) return;
     
    const Sentry = require('@sentry/browser');
    Sentry.init({
      dsn,
      tracesSampleRate: Number((import.meta as any)?.env?.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.05),
    });
  } catch {
    // ignore missing dependency
  }
}
