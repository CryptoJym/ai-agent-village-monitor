import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { config } from '../config';
import { inc } from '../metrics';
import { shortCircuitDuplicate } from './dedupe';
import { Queue } from 'bullmq';
import { getRedis } from '../queue/redis';

export interface WebhookPayload {
  action?: string;
  repository?: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  sender?: {
    login: string;
    id: number;
  };
  installation?: {
    id: number;
  };
  [key: string]: any;
}

export interface WebhookEvent {
  id: string;
  event: string;
  action?: string;
  payload: WebhookPayload;
  signature: string;
  deliveryId: string;
  timestamp: number;
}

export class WebhookHandler {
  private webhookQueue?: Queue;

  constructor() {
    this.initQueue();
  }

  private getSecret(): string | undefined {
    return process.env.WEBHOOK_SECRET ?? config.WEBHOOK_SECRET;
  }

  private async initQueue() {
    try {
      const redis = getRedis();
      if (redis) {
        this.webhookQueue = new Queue('github-webhooks', {
          connection: redis,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: {
              age: 3600, // 1 hour
              count: 100,
            },
            removeOnFail: {
              age: 86400, // 24 hours
            },
          },
        });
      }
    } catch (error) {
      console.warn('Failed to initialize webhook queue:', error);
    }
  }

  verifySignature(payload: Buffer, signature: string): boolean {
    const secret = this.getSecret();
    if (!secret) {
      return true; // No secret configured, skip verification
    }

    if (!signature) {
      return false;
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const digest = `sha256=${hmac.digest('hex')}`;

    // Timing-safe comparison
    const expected = Buffer.from(digest);
    const actual = Buffer.from(signature);

    if (expected.length !== actual.length) {
      return false;
    }

    return crypto.timingSafeEqual(expected, actual);
  }

  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract headers
      const signature = req.header('x-hub-signature-256') || '';
      const deliveryId = req.header('x-github-delivery') || '';
      const event = req.header('x-github-event') || '';
      const secret = this.getSecret();

      // Get raw body for signature verification
      const rawBody = (req as any).rawBody as Buffer;
      if (!rawBody) {
        res.status(400).json({ error: 'Raw body required for signature verification' });
        return;
      }

      // Verify signature
      if (secret) {
        const isValid = this.verifySignature(rawBody, signature);
        if (!isValid) {
          inc('webhook_signature_invalid', { event });
          res.status(401).json({ error: 'Invalid signature' });
          return;
        }
      }

      inc('webhook_signature_valid', { event });

      // Check for duplicates
      if (await shortCircuitDuplicate(req, res)) {
        return;
      }

      // Parse payload
      const payload: WebhookPayload = req.body;

      // Create webhook event
      const webhookEvent: WebhookEvent = {
        id: deliveryId,
        event,
        action: payload.action,
        payload,
        signature,
        deliveryId,
        timestamp: Date.now(),
      };

      // Queue for async processing
      if (this.webhookQueue) {
        await this.webhookQueue.add(`${event}.${payload.action || 'default'}`, webhookEvent, {
          jobId: deliveryId,
          priority: this.getEventPriority(event),
        });

        inc('webhook_queued', { event, action: payload.action || 'none' });
        res.status(202).json({ ok: true, queued: true, deliveryId });
      } else {
        // Process synchronously if queue not available
        await this.processEvent(webhookEvent);
        inc('webhook_processed_sync', { event, action: payload.action || 'none' });
        res.status(200).json({ ok: true, deliveryId });
      }
    } catch (error) {
      console.error('Webhook handling error:', error);
      inc('webhook_error', { event: req.header('x-github-event') || 'unknown' });
      next(error);
    }
  }

  private getEventPriority(event: string): number {
    // Higher priority = lower number
    const priorities: Record<string, number> = {
      push: 1,
      pull_request: 2,
      check_run: 3,
      issues: 4,
      issue_comment: 5,
      workflow_run: 6,
      deployment: 7,
      release: 8,
    };

    return priorities[event] || 10;
  }

  async processEvent(event: WebhookEvent): Promise<void> {
    try {
      const { default: processor } = await this.getProcessor(event.event);
      if (processor) {
        await processor(event);
        inc('webhook_processed', { event: event.event, action: event.action || 'none' });
      } else {
        console.warn(`No processor found for event: ${event.event}`);
        inc('webhook_no_processor', { event: event.event });
      }
    } catch (error) {
      console.error(`Error processing webhook event ${event.event}:`, error);
      inc('webhook_processing_error', { event: event.event });
      throw error;
    }
  }

  private async getProcessor(
    event: string,
  ): Promise<{ default: (event: WebhookEvent) => Promise<void> }> {
    try {
      switch (event) {
        case 'push':
          return await import('./processors/push');
        case 'pull_request':
          return await import('./processors/pull-request');
        case 'check_run':
          return await import('./processors/check-run');
        case 'issues':
          return await import('./processors/issues');
        default:
          return { default: async () => {} };
      }
    } catch (error) {
      console.warn(`Failed to load processor for ${event}:`, error);
      return { default: async () => {} };
    }
  }

  getQueue(): Queue | undefined {
    return this.webhookQueue;
  }
}

// Singleton instance
export const webhookHandler = new WebhookHandler();

// Express middleware
export function githubWebhookMiddleware(req: Request, res: Response, next: NextFunction) {
  webhookHandler.handleWebhook(req, res, next);
}
