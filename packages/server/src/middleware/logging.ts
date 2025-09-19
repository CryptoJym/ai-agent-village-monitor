import type { Request, Response, NextFunction } from 'express';
import { redactUrl, scrubHeaders } from './redact';

export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      try {
        const ms = Date.now() - start;
        const payload = {
          level: 'info',
          msg: 'request',
          reqId: (req as any).id,
          method: req.method,
          path: redactUrl(req.originalUrl || req.url),
          status: res.statusCode,
          duration_ms: ms,
          headers: scrubHeaders(req.headers as any),
        };

        console.info(JSON.stringify(payload));
        try {
          // Respect Do Not Track (DNT) and Global Privacy Control (GPC) for analytics metrics
          const dnt = String(req.headers['dnt'] ?? '').trim() === '1';
          const gpc =
            String(req.headers['sec-gpc'] ?? '').trim() === '1' ||
            String(req.headers['gpc'] ?? '').trim() === '1';
          if (!dnt && !gpc) {
            const { httpInc, observe } = require('../metrics') as typeof import('../metrics');
            httpInc(req.method, (req.route?.path || req.path || '/').toString(), res.statusCode);
            observe('http_response_ms', ms, {
              method: req.method,
              route: (req.route?.path || req.path || '/').toString(),
              status: String(res.statusCode),
            });
          }
        } catch {
          // Metrics pipeline optional; ignore failures.
        }
      } catch {
        // Logging output should not break request handling.
      }
    });
    next();
  };
}
