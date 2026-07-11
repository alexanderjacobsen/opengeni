import { describe, expect, test } from "bun:test";
import type { CodexCapacitySelectionContext, CodexLeaseAccountStatus } from "@opengeni/db";
import { testSettings } from "@opengeni/testing";
import { codexCapacityDecision } from "../src/activities/codex-capacity";

function account(
  id: string,
  overrides: Partial<CodexLeaseAccountStatus> = {},
): CodexLeaseAccountStatus {
  return {
    id,
    chatgptAccountId: `chatgpt-${id}`,
    label: id,
    accountEmail: null,
    planType: "pro",
    status: "active",
    allocatorEnabled: true,
    isActive: false,
    expiresAt: null,
    lastRefreshAt: null,
    lastError: null,
    primaryUsedPercent: 0,
    primaryResetAt: null,
    secondaryUsedPercent: 0,
    secondaryResetAt: null,
    usageCheckedAt: null,
    exhaustedUntil: null,
    connectorNamespaces: null,
    connectorsCheckedAt: null,
    activeLeaseCount: 0,
    selectionCount: 0,
    lastSelectedAt: null,
    ...overrides,
  };
}

describe("Codex capacity availability diagnostics", () => {
  test("eligibleCount uses the allocator's full health predicate", () => {
    const future = new Date("2100-01-01T00:00:00.000Z");
    const context: CodexCapacitySelectionContext = {
      accounts: [
        account("healthy"),
        account("cooling", { exhaustedUntil: future }),
        account("capped", { primaryUsedPercent: 95, primaryResetAt: future }),
      ],
      activeCredentialId: null,
      rotationEnabled: true,
      leaseRotationEnabled: true,
      rotationStrategy: "most_remaining",
      existingCredentialId: null,
      policyScope: null,
      unavailableDiagnostics: [],
      sessionId: "session-1",
      sessionPinnedCredentialId: null,
      sessionPinSource: null,
      sessionLastCredentialId: null,
      policyHash: null,
    };

    expect(
      codexCapacityDecision(
        context,
        testSettings({
          codexCredentialLeasingEnabled: true,
          codexRotationNearExhaustionPct: 90,
        }),
      ),
    ).toMatchObject({
      kind: "available",
      credentialId: "healthy",
      diagnostic: { connectedCount: 3, eligibleCount: 1 },
    });
  });
});
