-- Ensure at most one active session per agent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'agent_sessions_unique_active'
  ) THEN
    CREATE UNIQUE INDEX agent_sessions_unique_active ON "public"."AgentSession" ("agentId") WHERE "state" = 'active';
  END IF;
END $$;
