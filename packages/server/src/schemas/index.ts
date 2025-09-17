import { z } from 'zod';

export const OrgParam = z.object({ org: z.string().min(1) });

// Agent command payloads
export const AgentTaskCommand = z.object({ type: z.literal('task'), text: z.string().min(1) });
export const AgentRunTool = z.object({ command: z.literal('run_tool'), tool: z.string().min(1).optional(), args: z.array(z.any()).optional() });
export const AgentCommit = z.object({ command: z.literal('commit'), message: z.string().min(1) });
export const AgentPullRequest = z.object({ command: z.literal('pull_request'), title: z.string().min(1), body: z.string().optional() });
export const AgentCommandSchema = z.union([AgentTaskCommand, AgentRunTool, AgentCommit, AgentPullRequest]);

export type AgentCommand = z.infer<typeof AgentCommandSchema>;

