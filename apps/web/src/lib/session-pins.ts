// Cross-tab invalidation for personal session pins. Postgres remains truth;
// this message carries only workspace/session ids and tells sibling tabs to
// re-read. Cross-device clients reconcile through the normal page refresh/poll.

import type { Session } from "@/types";

const SESSION_PIN_CHANNEL_PREFIX = "opengeni.session-pins";

function channelName(workspaceId: string): string {
  return `${SESSION_PIN_CHANNEL_PREFIX}:${workspaceId}`;
}

/**
 * Merge only personal pin fields from a list/page projection into the open
 * route projection. Lifecycle and event-driven session fields remain owned by
 * the route/SSE reducer and cannot be regressed by a slower list poll.
 */
export function applySessionPinProjection(
  current: Session | null,
  projected: Pick<Session, "id" | "workspaceId" | "pinned" | "pinnedAt" | "pinVersion">,
): Session | null {
  if (!current || current.id !== projected.id || current.workspaceId !== projected.workspaceId) {
    return current;
  }
  const pinned = Boolean(projected.pinned);
  const pinnedAt = projected.pinnedAt ?? null;
  const pinVersion = projected.pinVersion ?? 0;
  // A page poll, mutation response, or legacy-replica response can finish
  // after a newer optimistic/authoritative projection is already visible.
  // Pin revisions are monotonic, so never let that older response undo the
  // newer header/list state. Equal revisions remain authoritative: they let a
  // server response replace the local optimistic timestamp for that revision.
  if (pinVersion < (current.pinVersion ?? 0)) {
    return current;
  }
  if (
    Boolean(current.pinned) === pinned &&
    (current.pinnedAt ?? null) === pinnedAt &&
    (current.pinVersion ?? 0) === pinVersion
  ) {
    return current;
  }
  return { ...current, pinned, pinnedAt, pinVersion };
}

export function notifySessionPinChanged(workspaceId: string, sessionId: string): void {
  if (typeof BroadcastChannel === "undefined") {
    return;
  }
  const channel = new BroadcastChannel(channelName(workspaceId));
  channel.postMessage({ type: "session-pin.changed", sessionId });
  channel.close();
}

export function subscribeToSessionPinChanges(
  workspaceId: string,
  onChange: (sessionId: string) => void,
): () => void {
  if (typeof BroadcastChannel === "undefined") {
    return () => undefined;
  }
  const channel = new BroadcastChannel(channelName(workspaceId));
  channel.addEventListener("message", (event: MessageEvent<unknown>) => {
    const message = event.data as { type?: unknown; sessionId?: unknown } | null;
    if (message?.type === "session-pin.changed" && typeof message.sessionId === "string") {
      onChange(message.sessionId);
    }
  });
  return () => channel.close();
}
