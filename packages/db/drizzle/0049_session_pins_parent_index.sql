-- opengeni:concurrent-index lock-timeout=5s
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "sessions_workspace_id_idx"
  ON "sessions" ("workspace_id", "id");