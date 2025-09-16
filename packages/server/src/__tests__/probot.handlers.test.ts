import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock bug services to observe calls
vi.mock('../bugs/service', () => ({
  createBugBot: vi.fn(async () => ({})),
  updateBugStatus: vi.fn(async () => ({})),
}));

describe('Probot handlers (framework-less)', () => {
  let handlers: Record<string, Function[]>;
  let app: any;
  let registerProbotHandlers: any;

  beforeEach(async () => {
    handlers = {};
    app = { on: (name: string, cb: any) => ((handlers[name] ||= []), handlers[name].push(cb)) };
    ({ registerProbotHandlers } = await import('../probot/app'));
    registerProbotHandlers(app);
  });

  async function trigger(eventName: string, context: any) {
    const list = handlers[eventName] || [];
    for (const cb of list) {
      await cb(context);
    }
  }

  it('handles issues.opened and dedupes duplicate deliveries', async () => {
    const payload = {
      action: 'opened',
      repository: { id: 123, full_name: 'org/repo', name: 'repo', owner: { id: 456, login: 'org' } },
      issue: { id: 789, number: 7, title: 'x', body: '' },
      organization: { id: 456, login: 'org' },
    };
    const id = 'dup-1';

    await trigger('issues.opened', { id, payload });
    await trigger('issues.opened', { id, payload });

    const { createBugBot } = await import('../bugs/service');
    expect((createBugBot as any).mock.calls.length).toBe(1);
  });

  it('handles issues.closed by resolving bug', async () => {
    const payload = {
      action: 'closed',
      repository: { id: 123, full_name: 'org/repo', name: 'repo', owner: { id: 456, login: 'org' } },
      issue: { id: 789, number: 7, title: 'x', body: '' },
      organization: { id: 456, login: 'org' },
    };
    const id = 'close-1';

    await trigger('issues.closed', { name: 'issues', id, payload });
    const { updateBugStatus } = await import('../bugs/service');
    expect((updateBugStatus as any).mock.calls.length).toBe(1);
  });

  it('creates high-severity bot on failed check_run.completed', async () => {
    const payload = {
      check_run: {
        conclusion: 'failure',
        head_sha: 'abc123',
        name: 'build',
        output: { summary: 'tests failed' },
        details_url: 'http://ci'
      },
      repository: { id: 123, full_name: 'org/repo', name: 'repo', owner: { id: 456, login: 'org' } },
      organization: { id: 456, login: 'org' },
    };

    await trigger('check_run.completed', { name: 'check_run', id: 'cr-1', payload });
    const { createBugBot } = await import('../bugs/service');
    expect((createBugBot as any).mock.calls.length).toBeGreaterThan(0);
    const lastCall = (createBugBot as any).mock.calls[(createBugBot as any).mock.calls.length - 1][0];
    expect(lastCall.severity).toBe('high');
  });
});
