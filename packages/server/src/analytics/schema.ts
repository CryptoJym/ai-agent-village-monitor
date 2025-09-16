import { z } from 'zod';

// Zod schemas for Analytics events and batches
// Mirrors types defined in @shared while enforcing runtime validation and stripping unknown fields

export const SessionStartEvent = z.object({
  type: z.literal('session_start'),
  ts: z.number().finite(),
  userId: z.string().min(1).optional(),
  villageId: z.string().min(1).optional(),
});

export const SessionEndEvent = z.object({
  type: z.literal('session_end'),
  ts: z.number().finite(),
  durationMs: z.number().int().nonnegative(),
  userId: z.string().min(1).optional(),
  villageId: z.string().min(1).optional(),
});

export const DialogueOpenEvent = z.object({
  type: z.literal('dialogue_open'),
  ts: z.number().finite(),
  source: z.string().min(1).optional(),
  villageId: z.string().min(1).optional(),
});

export const CommandExecutedEvent = z.object({
  type: z.literal('command_executed'),
  ts: z.number().finite(),
  agentId: z.string().min(1).optional(),
  command: z.string().min(1).max(64).optional(),
  villageId: z.string().min(1).optional(),
});

export const VillageViewEvent = z.object({
  type: z.literal('village_view'),
  ts: z.number().finite(),
  villageId: z.string().min(1),
});

export const AnalyticsEventSchema = z.union([
  SessionStartEvent,
  SessionEndEvent,
  DialogueOpenEvent,
  CommandExecutedEvent,
  VillageViewEvent,
]);

export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

export const AnalyticsBatchSchema = z.object({
  events: z.array(AnalyticsEventSchema).min(1),
  clientId: z.string().min(1).optional(),
  consent: z.boolean().optional(),
});

export type AnalyticsBatch = z.infer<typeof AnalyticsBatchSchema>;
