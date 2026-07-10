import type { Session } from "@opengeni/sdk";
import { useCallback } from "react";
import { useOpenGeni, type ClientOverride } from "../provider";
import { usePolledValue } from "./internal";

export type UseWorkspaceSessionsOptions = ClientOverride & {
  limit?: number | undefined;
  parentSessionId?: string | null | undefined;
  cursor?: string | undefined;
  search?: string | undefined;
  /** Refresh interval (ms) for fleet/manager views. Off by default. */
  pollIntervalMs?: number | undefined;
  enabled?: boolean | undefined;
};

export type UseWorkspaceSessionsResult = {
  /**
   * All visible rows, with pins first. This preserves the pre-pinning hook
   * contract for consumers that only read `sessions`.
   */
  sessions: Session[];
  /** The complete personal pinned section, also present in `sessions`. */
  pinned: Session[];
  nextCursor: string | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

/** List the workspace's sessions — the data behind fleet and manager views. */
export function useWorkspaceSessions(
  options: UseWorkspaceSessionsOptions = {},
): UseWorkspaceSessionsResult {
  const { client, workspaceId } = useOpenGeni(options);
  const limit = options.limit;
  const parentSessionId = options.parentSessionId;
  const cursor = options.cursor;
  const search = options.search;
  const load = useCallback(
    async () =>
      await client.listSessionPage(workspaceId, {
        ...(limit !== undefined ? { limit } : {}),
        ...(parentSessionId !== undefined ? { parentSessionId } : {}),
        ...(cursor !== undefined ? { cursor } : {}),
        ...(search !== undefined ? { search } : {}),
      }),
    [client, workspaceId, limit, parentSessionId, cursor, search],
  );
  const state = usePolledValue(load, {
    pollIntervalMs: options.pollIntervalMs,
    enabled: options.enabled,
  });
  const pinned = state.data?.pinned ?? [];
  const ordinary = state.data?.sessions ?? [];
  return {
    // The old hook returned every visible session. Keep that public behavior
    // while exposing `pinned` separately for the compact section. The API page
    // itself continues to paginate only `ordinary` rows via nextCursor.
    sessions: [...pinned, ...ordinary],
    pinned,
    nextCursor: state.data?.nextCursor ?? null,
    loading: state.loading,
    error: state.error,
    refresh: state.refresh,
  };
}
