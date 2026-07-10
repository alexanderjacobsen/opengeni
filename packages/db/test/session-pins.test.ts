import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { acquireSharedTestDatabase, type SharedTestDatabase } from "@opengeni/testing";
import postgres from "postgres";
import {
  createDb,
  createSession,
  getSessionForSubject,
  listSessionsForSubject,
  SessionPinVersionConflictError,
  setSessionPin,
  withWorkspaceRls,
  type Database,
  type DbClient,
} from "../src/index";
import { sql } from "drizzle-orm";

let available = true;
let shared: SharedTestDatabase | null = null;
let admin: postgres.Sql;
let client: DbClient;
let db: Database;

async function freshWorkspace(): Promise<{ accountId: string; workspaceId: string }> {
  const [account] = await admin<{ id: string }[]>`
    insert into managed_accounts (name) values ('session-pins-account') returning id`;
  const [workspace] = await admin<{ id: string }[]>`
    insert into workspaces (account_id, name) values (${account!.id}, 'session-pins-workspace') returning id`;
  return { accountId: account!.id, workspaceId: workspace!.id };
}

async function session(input: { accountId: string; workspaceId: string; message: string }) {
  return await createSession(db, {
    accountId: input.accountId,
    workspaceId: input.workspaceId,
    initialMessage: input.message,
    resources: [],
    metadata: {},
    model: "test-model",
    sandboxBackend: "none",
  });
}

beforeAll(async () => {
  shared = await acquireSharedTestDatabase("session-pins");
  if (!shared) {
    available = false;
    // eslint-disable-next-line no-console
    console.warn("[session-pins] docker unavailable, skipping");
    return;
  }
  admin = shared.admin;
  client = createDb(shared.appUrl);
  db = client.db;
}, 180_000);

afterAll(async () => {
  await client?.close().catch(() => undefined);
  await shared?.release();
});

describe("session pins (real PostgreSQL + FORCE RLS)", () => {
  test("is idempotent, monotonic across unpin/re-pin, and rejects stale versions", async () => {
    if (!available) return;
    const workspace = await freshWorkspace();
    const target = await session({ ...workspace, message: "pin target" });
    const subject = "user:one";

    const first = await setSessionPin(db, {
      workspaceId: workspace.workspaceId,
      subjectId: subject,
      sessionId: target.id,
      pinned: true,
    });
    expect(first).toMatchObject({ pinned: true, pinVersion: 1 });
    const retry = await setSessionPin(db, {
      workspaceId: workspace.workspaceId,
      subjectId: subject,
      sessionId: target.id,
      pinned: true,
      expectedVersion: 1,
    });
    expect(retry).toMatchObject({ pinned: true, pinVersion: 1 });

    const unpinned = await setSessionPin(db, {
      workspaceId: workspace.workspaceId,
      subjectId: subject,
      sessionId: target.id,
      pinned: false,
      expectedVersion: 1,
    });
    expect(unpinned).toMatchObject({ pinned: false, pinnedAt: null, pinVersion: 2 });
    const repinned = await setSessionPin(db, {
      workspaceId: workspace.workspaceId,
      subjectId: subject,
      sessionId: target.id,
      pinned: true,
      expectedVersion: 2,
    });
    expect(repinned).toMatchObject({ pinned: true, pinVersion: 3 });

    await expect(
      setSessionPin(db, {
        workspaceId: workspace.workspaceId,
        subjectId: subject,
        sessionId: target.id,
        pinned: false,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({
      name: "SessionPinVersionConflictError",
      current: { pinned: true, pinnedAt: repinned?.pinnedAt ?? null, pinVersion: 3 },
    } satisfies Partial<SessionPinVersionConflictError>);
  }, 60_000);

  test("isolates member pins, uses stable order, filters pins, and never duplicates normal pages", async () => {
    if (!available) return;
    const workspace = await freshWorkspace();
    const older = await session({ ...workspace, message: "ordinary older" });
    const pinnedFirst = await session({ ...workspace, message: "find pinned first" });
    const pinnedSecond = await session({ ...workspace, message: "find pinned second" });
    const newer = await session({ ...workspace, message: "ordinary newer" });
    await admin`
      update sessions set updated_at = now() - interval '4 minutes' where id = ${older.id}`;
    await admin`
      update sessions set updated_at = now() - interval '3 minutes' where id = ${pinnedFirst.id}`;
    await admin`
      update sessions set updated_at = now() - interval '2 minutes' where id = ${pinnedSecond.id}`;
    await admin`
      update sessions set updated_at = now() - interval '1 minute' where id = ${newer.id}`;

    await setSessionPin(db, {
      workspaceId: workspace.workspaceId,
      subjectId: "user:one",
      sessionId: pinnedFirst.id,
      pinned: true,
    });
    await setSessionPin(db, {
      workspaceId: workspace.workspaceId,
      subjectId: "user:one",
      sessionId: pinnedSecond.id,
      pinned: true,
    });
    await admin`
      update session_pins set pinned_at = now() - interval '2 minutes'
      where workspace_id = ${workspace.workspaceId} and subject_id = 'user:one' and session_id = ${pinnedFirst.id}`;
    await admin`
      update session_pins set pinned_at = now() - interval '1 minute'
      where workspace_id = ${workspace.workspaceId} and subject_id = 'user:one' and session_id = ${pinnedSecond.id}`;

    const firstPage = await listSessionsForSubject(db, workspace.workspaceId, {
      subjectId: "user:one",
      limit: 1,
    });
    expect(firstPage.pinned.map((row) => row.id)).toEqual([pinnedSecond.id, pinnedFirst.id]);
    expect(firstPage.sessions.map((row) => row.id)).toEqual([newer.id]);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(new Set([...firstPage.pinned, ...firstPage.sessions].map((row) => row.id)).size).toBe(3);

    const secondPage = await listSessionsForSubject(db, workspace.workspaceId, {
      subjectId: "user:one",
      limit: 1,
      cursor: JSON.parse(Buffer.from(firstPage.nextCursor!, "base64url").toString("utf8")) as never,
    }).catch(() => null);
    // Cursors must be decoded by the transport boundary; use the typed DB cursor
    // directly for this query-level pagination assertion.
    const newest = firstPage.sessions[0]!;
    const ordinarySecondPage = await listSessionsForSubject(db, workspace.workspaceId, {
      subjectId: "user:one",
      limit: 1,
      cursor: { updatedAt: new Date(newest.updatedAt), id: newest.id },
    });
    expect(secondPage).toBeNull();
    expect(ordinarySecondPage.sessions.map((row) => row.id)).toEqual([older.id]);
    expect(ordinarySecondPage.sessions.map((row) => row.id)).not.toContain(pinnedFirst.id);
    expect(ordinarySecondPage.pinned.map((row) => row.id)).toEqual([
      pinnedSecond.id,
      pinnedFirst.id,
    ]);

    const filtered = await listSessionsForSubject(db, workspace.workspaceId, {
      subjectId: "user:one",
      search: "pinned second",
    });
    expect(filtered.pinned.map((row) => row.id)).toEqual([pinnedSecond.id]);
    expect(filtered.sessions).toEqual([]);

    const otherMember = await listSessionsForSubject(db, workspace.workspaceId, {
      subjectId: "user:two",
    });
    expect(otherMember.pinned).toEqual([]);
    expect(otherMember.sessions.map((row) => row.id)).toContain(pinnedSecond.id);
  }, 60_000);

  test("returns no cross-workspace target and cascades a deleted session's pins", async () => {
    if (!available) return;
    const workspace = await freshWorkspace();
    const foreign = await freshWorkspace();
    const target = await session({ ...workspace, message: "delete pin target" });
    await setSessionPin(db, {
      workspaceId: workspace.workspaceId,
      subjectId: "user:one",
      sessionId: target.id,
      pinned: true,
    });
    expect(
      await setSessionPin(db, {
        workspaceId: foreign.workspaceId,
        subjectId: "user:one",
        sessionId: target.id,
        pinned: true,
      }),
    ).toBeNull();
    await admin`delete from sessions where id = ${target.id}`;
    const pins = await admin<{ count: number }[]>`
      select count(*)::int as count from session_pins where session_id = ${target.id}`;
    expect(pins[0]!.count).toBe(0);
    const invisible = await withWorkspaceRls(
      db,
      foreign.workspaceId,
      async (scoped) =>
        await scoped.execute(
          sql`select id from session_pins where workspace_id = ${workspace.workspaceId}`,
        ),
    );
    expect(invisible).toEqual([]);
    expect(await getSessionForSubject(db, workspace.workspaceId, target.id, "user:one")).toBeNull();
  }, 60_000);
});
