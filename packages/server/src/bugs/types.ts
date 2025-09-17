import { z } from 'zod';

export const BugStatus = z.enum(['open', 'assigned', 'in_progress', 'resolved']);
export type BugStatus = z.infer<typeof BugStatus>;

export const BugSeverity = z.enum(['low', 'medium', 'high']).nullish();
export type BugSeverity = z.infer<typeof BugSeverity>;

export const BugBot = z.object({
  id: z.string(),
  villageId: z.string(),
  provider: z.string().default('github'),
  repoId: z.string().optional(),
  issueId: z.string(),
  issueNumber: z.number().int().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: BugStatus.default('open'),
  severity: BugSeverity,
  assignedAgentId: z.string().nullable().default(null),
  metadata: z.record(z.any()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable().default(null),
  x: z.number().optional(),
  y: z.number().optional(),
});
export type BugBot = z.infer<typeof BugBot>;

export const CreateBugInput = BugBot.pick({
  id: true,
  villageId: true,
  provider: true,
  repoId: true,
  issueId: true,
  issueNumber: true,
  title: true,
  description: true,
  severity: true,
  x: true,
  y: true,
}).partial({ provider: true });
export type CreateBugInput = z.infer<typeof CreateBugInput>;

