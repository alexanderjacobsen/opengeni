import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { acquireBlankTestDatabase, type BlankTestDatabase } from "@opengeni/testing";
import postgres from "postgres";

import { migrate } from "../src/migrate";

const indexMigrationName = "0049_session_pins_parent_index.sql";
const tableMigrationName = "0049_session_pins_table.sql";
const requireRealDatabase = process.env.OPENGENI_REQUIRE_REAL_DB === "1";

let available = true;
let blank: BlankTestDatabase | null = null;
let admin: postgres.Sql;

beforeAll(async () => {
  blank = await acquireBlankTestDatabase("migration-0049-pins");
  if (!blank) {
    if (requireRealDatabase) {
      throw new Error(
        "[migration-0049-session-pins] OPENGENI_REQUIRE_REAL_DB=1 but PostgreSQL is unavailable",
      );
    }
    available = false;
    // eslint-disable-next-line no-console
    console.warn("[migration-0049-session-pins] docker unavailable, skipping");
    return;
  }
  admin = postgres(blank.databaseUrl, { max: 4 });
  await admin.unsafe(`
    CREATE TABLE schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const migrationsUrl = new URL("../drizzle/", import.meta.url);
  const prior = (await readdir(migrationsUrl))
    .filter((file) => file.endsWith(".sql") && file.localeCompare(indexMigrationName) < 0)
    .sort();
  for (const file of prior) {
    await admin.unsafe(await readFile(new URL(file, migrationsUrl), "utf8"));
    await admin`insert into schema_migrations (name) values (${file})`;
  }
}, 180_000);

afterAll(async () => {
  await admin?.end().catch(() => undefined);
  await blank?.release();
});

describe("0049 session pin migration (real PostgreSQL)", () => {
  test("bounds production lock contention and cleanly retries", async () => {
    if (!available || !blank) return;
    const blocker = postgres(blank.databaseUrl, { max: 1 });
    await blocker.unsafe("begin; lock table sessions in access exclusive mode");
    const startedAt = performance.now();
    let migrationError: unknown;
    try {
      await migrate(blank.databaseUrl);
    } catch (error) {
      migrationError = error;
    } finally {
      await blocker.unsafe("rollback");
      await blocker.end();
    }
    const elapsedMs = performance.now() - startedAt;
    expect(migrationError).toBeDefined();
    expect((migrationError as { code?: unknown }).code).toBe("55P03");
    expect(elapsedMs).toBeGreaterThanOrEqual(4_000);
    expect(elapsedMs).toBeLessThan(15_000);
    const [failedRecord] = await admin<{ count: number }[]>`
      select count(*)::int as count from schema_migrations
      where name in (${indexMigrationName}, ${tableMigrationName})`;
    expect(failedRecord?.count).toBe(0);

    await migrate(blank.databaseUrl);
    const [state] = await admin<
      {
        applied: boolean;
        indexValid: boolean;
        rowSecurity: boolean;
        forceRowSecurity: boolean;
      }[]
    >`
      select
        (select count(*) = 2 from schema_migrations
          where name in (${indexMigrationName}, ${tableMigrationName})) as applied,
        coalesce((
          select i.indisvalid
          from pg_index i
          join pg_class c on c.oid = i.indexrelid
          where c.relname = 'sessions_workspace_id_idx'
        ), false) as "indexValid",
        c.relrowsecurity as "rowSecurity",
        c.relforcerowsecurity as "forceRowSecurity"
      from pg_class c
      where c.oid = 'session_pins'::regclass`;
    expect(state).toEqual({
      applied: true,
      indexValid: true,
      rowSecurity: true,
      forceRowSecurity: true,
    });
  }, 30_000);
});
