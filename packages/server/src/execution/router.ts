import { Router } from 'express';
import { z } from 'zod';
import { runnerSessionService } from './runnerSessionService';

export const runnerSessionsRouter = Router();

const ProviderIdSchema = z.enum(['codex', 'claude_code']);

const RepoRefSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.enum(['github', 'gitlab', 'bitbucket']),
    owner: z.string().min(1),
    name: z.string().min(1),
    defaultBranch: z.string().optional(),
  }),
  z.object({
    provider: z.literal('local'),
    path: z.string().min(1),
    name: z.string().optional(),
    defaultBranch: z.string().optional(),
  }),
]);

const CheckoutSpecSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('branch'), ref: z.string().min(1) }),
  z.object({ type: z.literal('commit'), sha: z.string().min(1) }),
  z.object({ type: z.literal('tag'), tag: z.string().min(1) }),
]);

const TaskSpecSchema = z.object({
  title: z.string().min(1).max(200),
  goal: z.string().min(1).max(4000),
  constraints: z.array(z.string()).optional().default([]),
  acceptance: z.array(z.string()).optional().default([]),
  roomPath: z.string().optional(),
  branchName: z.string().optional(),
});

const PolicySpecSchema = z.object({
  shellAllowlist: z.array(z.string()).optional().default(['*']),
  shellDenylist: z.array(z.string()).optional().default([]),
  requiresApprovalFor: z
    .array(z.enum(['merge', 'deps_add', 'secrets', 'deploy']))
    .optional()
    .default(['merge', 'deps_add', 'secrets', 'deploy']),
  networkMode: z.enum(['restricted', 'open']).optional().default('open'),
});

const StartRunnerSessionSchema = z.object({
  villageId: z.string().min(1).max(100).optional().default('demo'),
  agentName: z.string().max(200).optional(),
  providerId: ProviderIdSchema,
  repoRef: RepoRefSchema,
  checkout: CheckoutSpecSchema.optional().default({ type: 'branch', ref: 'main' }),
  roomPath: z.string().max(500).optional(),
  task: TaskSpecSchema,
  policy: PolicySpecSchema.optional().default({}),
  env: z.record(z.string()).optional(),
});

runnerSessionsRouter.post('/runner/sessions', async (req, res, next) => {
  try {
    const parsed = StartRunnerSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid body', details: parsed.error.flatten() });
    }

    const userId = req.user?.sub != null ? String(req.user.sub) : undefined;
    const orgId = userId || 'demo-org';

    const { sessionId, agentId } = await runnerSessionService.startSession({
      orgId,
      userId,
      villageId: parsed.data.villageId,
      agentName: parsed.data.agentName,
      providerId: parsed.data.providerId,
      repoRef: parsed.data.repoRef as any,
      checkout: parsed.data.checkout as any,
      roomPath: parsed.data.roomPath,
      task: parsed.data.task as any,
      policy: parsed.data.policy as any,
      env: parsed.data.env,
    });

    return res.status(201).json({ sessionId, agentId });
  } catch (e) {
    next(e);
  }
});

runnerSessionsRouter.get('/runner/sessions/:id', async (req, res) => {
  const id = String(req.params.id);
  const state = runnerSessionService.getSessionState(id);
  if (!state) return res.status(404).json({ error: 'session not found' });
  return res.json(state);
});

const InputSchema = z.object({ data: z.string() }).strict();
runnerSessionsRouter.post('/runner/sessions/:id/input', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = InputSchema.safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: 'invalid body' });
    await runnerSessionService.sendInput(id, body.data.data);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

const StopSchema = z.object({ graceful: z.boolean().optional() }).strict();
runnerSessionsRouter.post('/runner/sessions/:id/stop', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = StopSchema.safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: 'invalid body' });
    await runnerSessionService.stopSession(id, body.data.graceful ?? true);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

const ApprovalSchema = z
  .object({
    decision: z.enum(['allow', 'deny']),
    note: z.string().max(2000).optional(),
  })
  .strict();
runnerSessionsRouter.post('/runner/sessions/:id/approvals/:approvalId', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const approvalId = String(req.params.approvalId);
    const body = ApprovalSchema.safeParse(req.body ?? {});
    if (!body.success) return res.status(400).json({ error: 'invalid body' });
    runnerSessionService.resolveApproval(id, approvalId, body.data.decision, body.data.note);
    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
