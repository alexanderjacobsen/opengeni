-- Personal, server-authoritative session pins. A pin belongs to the authenticated
-- member (`subject_id`), never to the session itself: shared workspace members
-- independently organize the same durable session rows. Deleting a session or
-- workspace cleans pins through FKs; no session activity/history field changes.

CREATE TABLE IF NOT EXISTS "session_pins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL REFERENCES "managed_accounts"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "subject_id" text NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "pinned" boolean NOT NULL DEFAULT true,
  "pinned_at" timestamptz,
  "version" integer NOT NULL DEFAULT 1,
  CONSTRAINT "session_pins_version_nonnegative" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_pins_subject_workspace_session_idx"
  ON "session_pins" ("subject_id", "workspace_id", "session_id");
CREATE INDEX IF NOT EXISTS "session_pins_workspace_subject_pinned_idx"
  ON "session_pins" ("workspace_id", "subject_id", "pinned", "pinned_at" DESC, "session_id" DESC);

ALTER TABLE "session_pins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_pins" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = current_schema() AND tablename = 'session_pins' AND policyname = 'workspace_isolation'
  ) THEN
    DROP POLICY workspace_isolation ON "session_pins";
  END IF;
END $$;
CREATE POLICY workspace_isolation ON "session_pins"
  USING (opengeni_private.workspace_rls_visible(account_id, workspace_id))
  WITH CHECK (opengeni_private.workspace_rls_visible(account_id, workspace_id));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'opengeni_app') THEN
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO opengeni_app',
      current_schema()
    );
  END IF;
END $$;