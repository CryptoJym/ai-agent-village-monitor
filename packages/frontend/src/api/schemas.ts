import { z } from 'zod';

export const HealthSchema = z.object({
  status: z.enum(['ok', 'error']),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof HealthSchema>;

export const AgentUpdateSchema = z.object({
  agentId: z.string(),
  state: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
});
export type AgentUpdate = z.infer<typeof AgentUpdateSchema>;

// Villages
export const VillageSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  githubOrgId: z.string(),
  isPublic: z.boolean(),
  lastSynced: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  viewerRole: z.enum(['owner', 'member', 'visitor', 'none']).optional(),
});
export type Village = z.infer<typeof VillageSchema>;

export const VillageAccessRowSchema = z.object({
  userId: z.number().int().positive(),
  username: z.string().nullable().optional(),
  githubId: z.string().nullable().optional(),
  role: z.enum(['owner', 'member', 'visitor']),
  grantedAt: z.string().optional(),
});
export type VillageAccessRow = z.infer<typeof VillageAccessRowSchema>;

export const VillageAccessListSchema = z.array(VillageAccessRowSchema);

// Preferences
export const PreferencesSchema = z.object({
  lod: z.enum(['high', 'medium', 'low']).default('high'),
  maxFps: z.number().int().min(30).max(240).default(60),
  colorblind: z.boolean().default(false),
  theme: z.enum(['dark', 'light']).default('dark'),
  keybindings: z.object({ talk: z.string().default('T') }).catch({ talk: 'T' }),
  analytics: z.object({ enabled: z.boolean().default(true) }).default({ enabled: true }),
});
export type Preferences = z.infer<typeof PreferencesSchema>;
