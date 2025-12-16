import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueGitHubWebhookEvent } from '../github/webhookQueue';
import { createQueues } from '../queue/queues';

vi.mock('../queue/queues', () => ({
  createQueues: vi.fn(),
}));

vi.mock('../audit/logger', () => ({
  audit: { log: vi.fn() },
}));

describe('enqueueGitHubWebhookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns enqueued=false when Redis/queues are unavailable', async () => {
    (createQueues as any).mockReturnValue(null);
    const res = await enqueueGitHubWebhookEvent({
      deliveryId: 'd1',
      event: 'issues',
      signature: 'sha256=x',
      payload: { action: 'opened' },
      receivedAt: Date.now(),
    });
    expect(res.ok).toBe(true);
    expect(res.enqueued).toBe(false);
  });

  it('enqueues a github-webhooks job when queues are available', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'job-1' });
    const getJob = vi.fn().mockResolvedValue(null);
    (createQueues as any).mockReturnValue({
      githubWebhooks: { add, getJob },
    });

    const res = await enqueueGitHubWebhookEvent({
      deliveryId: 'delivery-123',
      event: 'issues',
      signature: 'sha256=x',
      payload: { action: 'opened' },
      receivedAt: Date.now(),
    });
    expect(res.ok).toBe(true);
    expect(res.enqueued).toBe(true);
    expect(res.jobId).toBe('gh-webhook:delivery-123');
    expect(add).toHaveBeenCalledWith(
      'issues.opened',
      expect.objectContaining({ event: 'issues', deliveryId: 'delivery-123' }),
      expect.objectContaining({ jobId: 'gh-webhook:delivery-123' }),
    );
  });

  it('dedupes when an existing job is still running', async () => {
    const add = vi.fn();
    const getState = vi.fn().mockResolvedValue('active');
    const getJob = vi.fn().mockResolvedValue({ getState });
    (createQueues as any).mockReturnValue({
      githubWebhooks: { add, getJob },
    });

    const res = await enqueueGitHubWebhookEvent({
      deliveryId: 'delivery-123',
      event: 'issues',
      signature: 'sha256=x',
      payload: { action: 'opened' },
      receivedAt: Date.now(),
    });
    expect(res.ok).toBe(true);
    expect(res.enqueued).toBe(false);
    expect(add).not.toHaveBeenCalled();
  });
});
