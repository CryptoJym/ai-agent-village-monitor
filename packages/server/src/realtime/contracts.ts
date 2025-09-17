import { z } from 'zod';

export const JoinVillageSchema = z.object({
  villageId: z.string().min(1),
});

export const JoinAgentSchema = z.object({
  agentId: z.string().min(1),
});

export const JoinRepoSchema = z.object({
  repoId: z.string().min(1),
});

export type JoinVillagePayload = z.infer<typeof JoinVillageSchema>;
export type JoinAgentPayload = z.infer<typeof JoinAgentSchema>;
export type JoinRepoPayload = z.infer<typeof JoinRepoSchema>;

// Example outbound event schemas (documented for consistency)
export const AgentUpdateSchema = z.object({
  agentId: z.string(),
  status: z.string(),
  ts: z.number().int(),
});

export const WorkStreamSchema = z.object({
  agentId: z.string(),
  message: z.string(),
  ts: z.number().int(),
});

export const BugBotSpawnSchema = z.object({ id: z.string() });
export const BugBotResolvedSchema = z.object({ id: z.string() });

