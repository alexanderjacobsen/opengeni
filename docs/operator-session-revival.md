# Operator session revival

This runbook covers one narrow recovery action: enqueueing a new user message
onto one exact existing session through OpenGeni's normal control-plane
admission path. It is intended for a session whose durable conversation remains
valid but whose workflow needs a new message to revive it (normally `failed` or
`idle`). It does not repair or rewrite session history.

The helper is `scripts/operator/revive-session.ts`, exposed as:

```bash
bun run operator:revive-session --help
```

## Safety contract

- **Dry-run is the default.** Only `--apply` enables writes.
- `--workspace-id`, `--session-id`, and `--client-event-id` are mandatory,
  canonical lowercase identifiers. The client event id must have this exact
  deterministic form:

  ```text
  operator-revival:<workspace-id>:<session-id>:<stable-operation-key>
  ```

  Choose the final key once from the incident and recovery step, for example
  `ope-22-revive-1`, and reuse it for every retry. Do not use a timestamp or a
  newly generated UUID.
- Apply additionally requires a non-empty `--message-file`, explicit `--model`,
  and explicit `--reasoning-effort`. Message text is read from the file and is
  never emitted by the helper.
- The default queue policy rejects a session with `queued`, `running`, or
  `requires_action` work. `--queue-policy append` is the only override; it
  deliberately enqueues behind that work and does not cancel, bypass, approve,
  or reorder anything.
- A duplicate client event is refused and returns only the existing event ID.
  The helper never assumes that one row proves every later enqueue/wake step
  completed, and it never replays a partially completed admission automatically.
- The helper emits only stable target/result IDs, statuses, and refusal codes.
  It never emits message text, event payloads, session metadata, connection
  details, credentials, or upstream error messages.

## What apply does

Apply composes the same production control-plane dependencies as the API:

1. `createDb` with the configured search path and RLS strategy;
2. the managed NATS event bus, using the existing control-plane authentication
   configuration when present;
3. a Temporal client that wakes the session with `signalWithStart`; and
4. the shared `acceptSessionUserMessage` core function.

The helper first reads the session, duplicate client event, and pending turns
through workspace-scoped DB APIs. The core apply receives one synthetic grant
with exactly:

```json
{
  "workspaceId": "<requested workspace>",
  "accountId": "<account from the workspace-scoped session row>",
  "subjectId": "operator:session-revival",
  "permissions": ["workspace:admin"]
}
```

The grant is not accepted from CLI input. The requested workspace/session are
checked again against the row returned under workspace RLS. With the default
queue policy, the shared locked append path rechecks busy session/turn state so
work that races with preflight causes a refusal rather than an accidental
append.

There is no raw SQL in the helper, no direct row edit, no history/run-state
rewrite, no sandbox or provider call, and no cloud secret fetch. Apply uses only
credentials already supplied to the normal OpenGeni control-plane process. It
does not add a new credential, permission, or tenancy bypass.

## Procedure

Run this only from a reviewed OpenGeni revision in the deployment's
control-plane environment, where the normal database, NATS, and Temporal
settings are already injected. Do not copy production credentials into a shell
history or pass them as CLI arguments.

1. Prepare the approved recovery message in an operator-controlled file. Limit
   access to the incident operators; the helper does not need the file after the
   command exits.

2. Set exact IDs and one deterministic operation identity:

   ```bash
   WORKSPACE_ID='<workspace-uuid>'
   SESSION_ID='<session-uuid>'
   CLIENT_EVENT_ID="operator-revival:${WORKSPACE_ID}:${SESSION_ID}:ope-22-revive-1"
   ```

3. Run the read-only preflight:

   ```bash
   bun run operator:revive-session -- \
     --workspace-id "$WORKSPACE_ID" \
     --session-id "$SESSION_ID" \
     --client-event-id "$CLIENT_EVENT_ID"
   ```

   A normal revival target reports `mode: "dry_run"`, `status: "ready"`, the
   session status, and an empty pending-turn list. `refused` exits with code 2.
   Infrastructure errors exit with code 1 and intentionally omit upstream error
   text; correlate using the stable IDs in normal control-plane logs.

4. If preflight is approved, rerun the same identity with all apply fields:

   ```bash
   bun run operator:revive-session -- \
     --workspace-id "$WORKSPACE_ID" \
     --session-id "$SESSION_ID" \
     --client-event-id "$CLIENT_EVENT_ID" \
     --apply \
     --message-file /operator-controlled/recovery-message.txt \
     --model '<explicit-model-id>' \
     --reasoning-effort '<none|minimal|low|medium|high|xhigh>'
   ```

   Do not add `--queue-policy append` merely to get past a refusal. Inspect the
   listed turn IDs/statuses first. Select append only when the incident owner has
   explicitly decided the recovery message should wait behind all current work:

   ```bash
   --queue-policy append
   ```

5. Save the JSON result in the incident evidence. `status: "accepted"` returns
   the new durable `eventId`, `turnId`, and turn status. A retry with the same
   client event is refused with `refusal: "duplicate_client_event"` and the
   existing `eventId`; it performs no second write. Inspect the normal read-only
   event/turn surfaces before deciding whether any separate recovery is needed.

6. Verify through normal read-only session/event/turn surfaces that the returned
   event and turn exist in the exact workspace/session, then observe the normal
   run lifecycle. A failed or idle session should move through `queued`/`running`
   and eventually settle according to the turn outcome. The helper's acceptance
   proves admission, not model success.

## Audit evidence

Record all of the following in the incident/change record:

- reviewed OpenGeni source/deployment revision;
- exact workspace ID, session ID, and deterministic client event ID;
- dry-run JSON result, including session and pending-turn statuses;
- whether the default reject policy or explicit append policy was used, and the
  incident-owner approval for append;
- apply JSON result (`eventId`, `turnId`, and status only);
- read-only post-apply verification and eventual turn/session outcome; and
- the approved recovery-message artifact in access-controlled incident storage,
  not in the CLI output or repository.

## Rollback and no-delete semantics

Dry-run writes nothing and needs no rollback. Apply is intentionally
append-only: the durable user event is audit history and must not be deleted or
edited, and this helper exposes no delete/rollback operation.

If an accepted turn should not run:

- while it is still queued, use the normal queued-turn cancellation API; that
  records a `cancelled` state and event rather than deleting the row;
- while it is running, use the normal session interrupt/stop control; and
- if corrective context is needed, append a new corrective message with a new
  deterministic operation key.

Never roll back by editing `sessions`, `session_turns`, `session_events`,
`session_history_items`, or Temporal state directly. Preserve the original
event/turn IDs in the audit record.