# Codex subscription rotation

This is the canonical contract for selecting, leasing, refreshing, and failing
over ChatGPT/Codex subscription credentials. The implementation sources are
`apps/worker/src/activities/agent-turn.ts`,
`apps/worker/src/activities/codex-rotation.ts`, and the Codex accessors in
`packages/db/src/index.ts`.

## Security and scope

The **workspace is the complete scheduling boundary**.

- Credential rows, usage snapshots, cooldowns, fairness cursors, active pointers,
  session pins/last-used pointers, and leases are workspace-local and protected by
  FORCE RLS.
- OpenGeni does not create an account-global/provider-global subscription identity
  or correlate the same ChatGPT account across workspaces or managed accounts.
- If a user connects the same external subscription in two workspaces, both
  workspaces may use it concurrently. A lease/cooldown in one workspace never
  blocks or mutates the other.
- A selected credential id is revalidated against the transaction's RLS-visible
  candidate set. Composite `(workspace_id, credential_id)` lease FKs and triggers
  on legacy id-only pin/last/active references provide schema-level defense in
  depth against malformed internal writes.

This scope protects tenant isolation. Provider-side allowance is naturally
shared when the same external account is connected twice; each workspace learns
provider exhaustion independently and rotates among its own alternatives.

## Atomic selection and fairness

When `OPENGENI_CODEX_CREDENTIAL_LEASING_ENABLED=true`, every Codex turn calls
`acquireCodexCredentialLease` before model/tool preparation:

1. Start one RLS-scoped Postgres transaction and verify the turn belongs to the
   exact account/workspace.
2. Materialize and lock that workspace's `codex_rotation_settings` row with
   `FOR UPDATE`. Concurrent replicas wait; they do not `SKIP LOCKED`.
3. Reap expired workspace leases and read all workspace credentials plus the
   count of unexpired leases held by other turns.
4. Run the pure strategy and revalidate its chosen id against that candidate set.
5. Upsert the unique `(workspace_id, turn_id)` lease, increment the selected
   credential's server-held fairness cursor, and advance the active pointer in
   the same transaction.

`most_remaining` ranks eligible credentials by:

1. fewest active DB leases;
2. most remaining capacity across the binding five-hour/weekly windows;
3. fewest prior selections;
4. least-recent selection, then stable creation/id order.

The first and third/fourth inputs are server-held. Provider usage headers improve
capacity ranking but are **never the sole atomic allocator**. Consequently a
burst sees earlier reservations and spreads before delayed usage headers move.

The workspace active credential is a cursor, not a sticky lease. A healthy
explicit session pin wins while eligible; a pinned credential that becomes
exhausted, unauthorized, forbidden, or otherwise quarantined may fail over to a
healthy workspace alternative. `rotation_enabled=false` and
`drain_then_next` remain explicit sticky product policies.

The unique same-turn lease is idempotent. A one-minute heartbeat renews its
five-minute TTL throughout long tool/model runs; normal completion releases it
idempotently. A killed worker stops renewing, and expiry lets a successor turn
reclaim capacity. If a live activity discovers that its lease was lost, a
holder/generation plus worker-redispatch-fenced transaction either requeues that
still-current turn from its durable checkpoint or treats the activity as stale;
it never falls through to an unfenced terminal write. Credential leases do not
serialize inference: they are load signals used to spread concurrent turns, not
exclusive locks on an account.

## Reset and failure semantics

Both the five-hour and weekly allowance windows bind. A cached capped window whose
provider reset timestamp has elapsed becomes eligible immediately; an all-capped
pool performs one bounded live usage refresh before idling. Unknown reset data
always yields a positive bounded delay, never a zero-delay loop.

Only a **definitive credential/account refusal** can move the same durable turn to
another credential:

| Failure | State transition | Automatic credential failover |
| --- | --- | --- |
| First 401 | One forced token refresh and one request retry under a DB refresh lock | Not yet |
| Second 401 | Credential `needs_relogin` | Yes, if another eligible credential exists |
| 403 | Credential `error` | Yes, if another eligible credential exists |
| `usage_limit_reached` / explicit quota | Cooldown to the latest still-binding reset, or one five-hour fallback | Yes |
| Other 429 / explicit rate-limit code | Provider retry-after, or bounded backpressure cooldown | Yes |
| Network break, 5xx, invalid content, malformed/partial 200 stream | No credential quarantine | **No** |

Before definitive failover, the worker flushes streamed events and reconciles
`session_history_items`, then quarantines status/cooldown only through the exact
live holder/generation. It increments a persisted per-turn failover counter,
emits `turn.preempted`, and requeues the **same turn row**. This is an explicit
checkpoint/resume, not a Temporal or SDK blind retry. The resumed attempt receives
a side-effect verification notice when progress already exists. The counter is
bounded by pool size so a malformed classification cannot walk forever; a stale
holder cannot quarantine a credential or settle the turn.

Ambiguous failures never walk the pool because a partial stream may already have
performed tools or consumed allowance. Every terminal failure path reconciles
conversation truth before marking the turn failed, so a later user revival does
not replay work absent from history.

Rotating refresh tokens are protected separately: a workspace credential-scoped
Postgres advisory transaction lock serializes API/worker replicas before the
provider refresh call, waiters re-read the row after acquiring the lock, and the
existing `(id, version)` CAS remains the stale-family write fence.

## Rollout and rollback

Migration `0049_codex_credential_leases.sql` is additive. It creates the
workspace-local lease table and fairness columns, strengthens workspace reference
integrity, and adds a separate `lease_rotation_enabled` rollout bit. Both that bit
and the legacy `rotation_enabled` column keep a database default of `false`, so a
schema-first migration or an older binary can never opt a workspace into mixed-mode
rotation. After the deployment flag is enabled, migration-compatible API/worker
code explicitly sets the new bit only when it creates a rotation-setting row;
existing rows are not updated, preserving an existing false value as operator/user
intent.

Safe rollout order:

1. Apply the migration and deploy the compatible revision with
   `OPENGENI_CODEX_CREDENTIAL_LEASING_ENABLED=false`.
2. Wait until every API/worker replica is on that revision. Mixed old/new workers
   still use legacy pin→active selection and never touch the lease table.
3. Enable the flag in staging, prove concurrent distribution and exhaustion
   recovery, then enable the same revision/config in production.

Immediate rollback is setting the flag to `false`; this restores the legacy
selection path without a schema rollback. The additive table/columns remain inert.
An older binary is also compatible with the additive schema.

## Secret-safe observability

Every leased selection emits workspace-RLS event `codex.credential.selected`
with the stable credential-row id, strategy/reason, pool counts, and reuse flag—no
tokens, provider bodies, email, or external ChatGPT identity. Activity spans carry
the stable credential id. Counters cover selections, definitive failure outcomes,
and eligible-pool depth. `CODEX_DEBUG` logs status/request id only, never the
provider response body.

The default PrometheusRule alerts when a workspace observes zero eligible
credentials (critical) or one eligible credential (warning). Operators should
correlate those alerts with `codex.credential.selected`,
`codex.account.switched`, and `turn.preempted`/`turn.failed` events.

## Verification

- Pure unit/property coverage:
  `apps/worker/test/codex-rotation.test.ts`,
  `apps/worker/test/codex-usage-limit.test.ts`, and
  `packages/codex/test/fetch.test.ts`.
- Real Postgres concurrency/RLS/failure injection:
  `packages/db/test/codex-credential-leases.test.ts`.
- Production release proof must additionally show concurrent live turns selecting
  distinct eligible credential ids and one controlled exhausted credential
  recovering on another id without a duplicate turn/message.
