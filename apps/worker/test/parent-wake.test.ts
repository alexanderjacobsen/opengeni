import { expect, mock, test } from "bun:test";
import type { Database } from "@opengeni/db";
import type { EventBus } from "@opengeni/events";
import { testSettings } from "@opengeni/testing";
import { notifyParentOfChildTerminal, type NotifyServices } from "../src/activities/parent-wake";

test("disabled child-completion wakes return before every parent side effect", async () => {
  const info = mock(() => undefined);
  const error = mock(() => undefined);
  const publish = mock(async () => undefined);
  const wakeSessionWorkflow = mock(async () => undefined);
  const db = new Proxy(
    {},
    {
      get() {
        throw new Error("disabled parent wake touched the database");
      },
    },
  ) as Database;

  await notifyParentOfChildTerminal(
    {
      db,
      bus: { publish } as unknown as EventBus,
      settings: testSettings({ childCompletionParentWakeEnabled: false }),
      observability: { info, error } as unknown as NotifyServices["observability"],
      wakeSessionWorkflow,
    },
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "idle",
  );

  expect(publish).not.toHaveBeenCalled();
  expect(wakeSessionWorkflow).not.toHaveBeenCalled();
  expect(info).not.toHaveBeenCalled();
  expect(error).not.toHaveBeenCalled();
});
