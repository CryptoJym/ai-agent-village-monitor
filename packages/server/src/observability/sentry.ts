export type SentryLike = { captureException: (e: any, ctx?: any) => void } | null;

let sentryImpl: SentryLike = null;

export function initSentry() {
  const dsn = process.env.SENTRY_DSN || process.env.BACKEND_SENTRY_DSN;
  if (!dsn) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');
    Sentry.init({ dsn, tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.05) });
    sentryImpl = Sentry;
  } catch {
    sentryImpl = null;
  }
  return sentryImpl;
}

export function sentry(): SentryLike { return sentryImpl; }

