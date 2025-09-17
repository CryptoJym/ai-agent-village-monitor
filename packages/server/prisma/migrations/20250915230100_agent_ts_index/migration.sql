-- Composite index to accelerate per-agent time-ordered queries
CREATE INDEX IF NOT EXISTS "WorkStreamEvent_agentId_ts_idx"
  ON "public"."WorkStreamEvent"("agentId", "ts");

