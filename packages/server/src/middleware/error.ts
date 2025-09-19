import type { NextFunction, Request, Response } from 'express';

export function notFound(req: Request, res: Response) {
  const requestId = (req as any).id;
  // Include both top-level code for legacy tests and nested error envelope
  res
    .status(404)
    .json({ code: 'NOT_FOUND', error: { message: 'Not Found', code: 'NOT_FOUND' }, requestId });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as any).id;
  // Handle body parser JSON errors
  const isParseError =
    err?.type === 'entity.parse.failed' ||
    (err?.name === 'SyntaxError' && /JSON/.test(String(err?.message || '')));
  const status: number = isParseError ? 400 : typeof err?.status === 'number' ? err.status : 500;
  // Prefer explicit code on the error, else infer from status
  const code: string =
    typeof err?.code === 'string'
      ? err.code
      : status === 400
        ? 'VALIDATION_ERROR'
        : status === 401
          ? 'UNAUTHORIZED'
          : status === 403
            ? 'FORBIDDEN'
            : status === 404
              ? 'NOT_FOUND'
              : status === 409
                ? 'CONFLICT'
                : status === 429
                  ? 'RATE_LIMITED'
                  : 'INTERNAL_ERROR';
  let message: string =
    typeof err?.message === 'string' ? err.message : status >= 500 ? 'Internal Server Error' : code;
  if (isParseError) message = 'Malformed JSON';

  // Log structured error
  try {
    const payload = {
      level: 'error',
      msg: 'request_error',
      reqId: requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      status,
      code,
    };
    console.error(JSON.stringify(payload));
    try {
      const { sentry, initSentry } =
        require('../observability/sentry') as typeof import('../observability/sentry');
      initSentry();
      sentry()?.captureException(err, {
        requestId: (req as any).id,
        tags: { path: req.originalUrl || req.url },
      });
    } catch {
      // Observability pipeline unavailable; continue without Sentry capture.
    }
  } catch {
    // Logging failure should not crash error middleware.
  }

  // For 5xx errors, avoid leaking internal details
  const safeMessage = status >= 500 ? 'Internal Server Error' : message;
  if (status === 401) {
    res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
  }
  const envelope: any = { error: { code, message: safeMessage }, requestId };
  // If a ZodError or details are present, attach a minimal representation
  if (err?.name === 'ZodError' || err?.details) {
    const details = err?.details || (err?.flatten ? err.flatten() : undefined);
    if (details) envelope.error.details = details;
  }
  res.status(status).json(envelope);
}
