import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enqueueHouseRepoAnalysis } from '../houses/repoAnalysisQueue';
import { createQueues } from '../queue/queues';

vi.mock('../queue/queues', () => ({
  createQueues: vi.fn(),
}));

vi.mock('../audit/logger', () => ({
  audit: { log: vi.fn() },
}));

describe('enqueueHouseRepoAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns enqueued=false when Redis/queues are unavailable', async () => {
    (createQueues as any).mockReturnValue(null);
    const res = await enqueueHouseRepoAnalysis({ houseId: 'house-1' });
    expect(res.ok).toBe(true);
    expect(res.enqueued).toBe(false);
  });

  it('enqueues a repo-analysis job when queues are available', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'job-1' });
    const getJob = vi.fn().mockResolvedValue(null);
    (createQueues as any).mockReturnValue({
      repoAnalysis: { add, getJob },
    });

    const res = await enqueueHouseRepoAnalysis({ houseId: 'house-123' });
    expect(res.ok).toBe(true);
    expect(res.enqueued).toBe(true);
    expect(res.jobId).toMatch(/^repo-analysis:house-123:[0-9a-f]{12}$/);
    expect(add).toHaveBeenCalledWith(
      'analyze',
      { houseId: 'house-123' },
      expect.objectContaining({
        jobId: expect.stringMatching(/^repo-analysis:house-123:[0-9a-f]{12}$/),
      }),
    );
  });

  it('dedupes when an existing job is still running', async () => {
    const add = vi.fn();
    const getState = vi.fn().mockResolvedValue('active');
    const getJob = vi.fn().mockResolvedValue({ getState });
    (createQueues as any).mockReturnValue({
      repoAnalysis: { add, getJob },
    });

    const res = await enqueueHouseRepoAnalysis({ houseId: 'house-123' });
    expect(res.ok).toBe(true);
    expect(res.enqueued).toBe(false);
    expect(add).not.toHaveBeenCalled();
  });
});
