import { z } from 'zod';

// Shared Zod schemas for HTTP endpoints

// Agent command payloads accepted by /api/agents/:id/command
// Supports simple command messages and structured tool/commit/PR actions.
export const AgentCommandSchema = z.union([
  // Run tool with tool in args
  z.object({
    command: z.literal('run_tool'),
    args: z.object({ tool: z.string().min(1) }).passthrough(),
  }),
  // Run tool with top-level tool
  z.object({
    command: z.literal('run_tool'),
    tool: z.string().min(1),
    args: z.record(z.any()).optional(),
  }),
  z.object({ command: z.literal('commit'), message: z.string().min(1) }),
  z.object({
    command: z.literal('pull_request'),
    title: z.string().min(1),
    body: z.string().optional(),
    draft: z.boolean().optional(),
  }),
  // Generic message-based command
  z.object({ type: z.string().min(1), text: z.string().min(1) }),
  // Fallback generic command supports any command string with optional args
  z.object({ command: z.string().min(1), args: z.record(z.any()).optional() }),
]);

// User preferences (PATCH/PUT /api/users/me/preferences)
export const UserPreferencesSchema = z.object({
  lod: z.enum(['high', 'medium', 'low']).optional(),
  maxFps: z.number().int().positive().max(240).optional(),
  colorblind: z.boolean().optional(),
  theme: z.enum(['dark', 'light']).optional(),
  keybindings: z.record(z.string()).optional(),
  analytics: z
    .object({ enabled: z.boolean().default(true) })
    .partial()
    .optional(),
});

export type AgentCommand = z.infer<typeof AgentCommandSchema>;
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
