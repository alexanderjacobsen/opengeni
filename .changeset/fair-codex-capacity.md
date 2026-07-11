---
"@opengeni/api-router": patch
"@opengeni/codex": patch
"@opengeni/config": patch
"@opengeni/contracts": patch
"@opengeni/core": patch
"@opengeni/db": patch
"@opengeni/runtime": patch
"@opengeni/sdk": patch
"@opengeni/worker-bundle": patch
---

Add workspace-local, holder-fenced Codex subscription leases with deterministic
fairness across worker replicas, explicit allocator eligibility, and
failure-classified same-turn failover. All-exhausted active goals now persist one
generation- and policy-fenced capacity waiter, wake from authoritative reset
timers or revisioned capacity mutations, survive Temporal restart and
continue-as-new, and enqueue at most one normal continuation without synthetic
user messages, full-turn replay, provider/model rewriting, or automatic
entitlement redemption.

Expose a generic accepted-turn policy-scope and per-scope unavailable-diagnostic
seam for future named pools while resolving exact live/frozen same-turn reuse
before membership filtering. Preserve manual versus policy pin semantics and
session-sharded cache affinity without moving an in-flight lease or the legacy
workspace pointer for policy homes.