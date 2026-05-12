# Client Integration Reference

Use this when building or explaining a client that consumes OpenGeni as a service. The client may be a SaaS product, internal portal, CLI, SDK, workflow engine, or custom UI. Do not assume the OpenGeni source repo is checked out locally.

Canonical source repo: `https://github.com/Cloudgeni-ai/opengeni`.

## First Determine Context

Ask or infer:

- API base URL for the deployed OpenGeni service.
- Whether the user needs a browser UI, server-side integration, CLI, SDK wrapper, or docs.
- Whether file upload, repository attachment, MCP tools, approvals, interrupts, or schedules are in scope.
- Whether auth/tenancy exists in the target deployment. The base repo may not ship auth yet, but a deployment can add an API gateway, reverse proxy, or product auth layer.
- Whether exact source behavior is needed. If yes, inspect the repo or the deployed service contract rather than trusting this reference.

## Client Mental Model

A client should treat OpenGeni as a durable agent-work API:

1. Read client config and capabilities.
2. Create a session with an initial task.
3. Subscribe to the session event stream.
4. Render events into a timeline/status view.
5. Send follow-up user messages or control events.
6. Upload files before attaching them as resources.
7. Attach repositories/files/tools to sessions or turns.
8. Handle approvals, interrupts, failed states, and reconnect/replay.
9. Optionally create and manage scheduled tasks.

The client should not talk directly to the worker, NATS, Temporal, Postgres, or sandbox backend. Those are OpenGeni internals.

## Discover The Current Public Surface

If the repo is available, inspect:

```bash
rg -n "app\\.(get|post|patch|delete|all)\\(" apps/api/src
sed -n '1,260p' packages/contracts/src/index.ts
sed -n '1,320p' apps/web/src/api.ts
sed -n '1,260p' apps/web/src/types.ts
```

If only a deployment is available:

- Call the health endpoint if exposed.
- Call the client config endpoint if exposed.
- Use browser devtools or existing UI API calls to infer current paths.
- Ask the operator for API docs or source revision.

## Core Client Flow

Prefer this shape, adjusted to the current contracts:

1. **Fetch config**: get default model, allowed models, reasoning efforts, MCP providers, and whether file uploads are enabled.
2. **Prepare resources**: upload files first; select repository resources from available repo/source picker; select MCP tool providers by id.
3. **Create session**: send initial message plus selected resources/tools/model/sandbox options.
4. **Connect SSE**: stream events from the returned session id. Use the last event sequence as the reconnect cursor.
5. **Render timeline**: display user messages, agent deltas/completions, reasoning, tool calls, sandbox operations, approvals, status changes, failures, and final output according to current event types.
6. **Send follow-ups**: post a user message into the existing session; the API queues another turn.
7. **Control work**: send interrupt or approval-decision events when the session requires action.
8. **Replay**: on reload or reconnect, list events after the last known sequence before resuming the live stream.

## Event Handling Rules

Use the event log as the source of truth for the UI:

- Store the latest sequence seen by the client.
- Reconnect SSE with the latest sequence or equivalent cursor supported by the current API.
- Do not assume live SSE delivery is complete; replay/backfill from the event list endpoint when reconnecting.
- Treat event types as extensible. Unknown events should be logged or displayed generically, not crash the client.
- Keep status projection separate from raw event storage if building an SDK or UI state model.

## File Upload Flow

The client should not send large file bytes through session creation. Use the upload API flow:

1. Create an upload with filename, content type, size, and optional checksum.
2. PUT bytes to the returned object-storage URL with required headers.
3. Complete the upload so OpenGeni verifies metadata and marks the file ready.
4. Attach the resulting file id as a file resource on a session, turn, or scheduled task.

Do not show file resources as usable until upload completion returns a ready file.

## Resource And Tool Selection

Resources are things made available to the agent, commonly files and repositories. Tools are currently selected as MCP provider references.

Client UX should distinguish:

- **File attachments**: upload, then attach by file id.
- **Repository attachments**: select repo URL/ref/mount information; GitHub App metadata may be needed for scoped token minting.
- **Tool providers**: select configured MCP server ids, such as document search or custom enterprise search.
- **Sandbox backend**: expose only if the product wants users to choose execution backend; otherwise use deployment defaults.

## Approvals And Interrupts

Approvals are part of the session event/control loop:

- When events indicate the session requires action, render the requested approvals.
- Send an approval decision with the approval id and approve/reject decision.
- Keep the stream open or reconnect after sending the decision.

Interrupts should be modeled as cancellation requests, not guaranteed immediate process termination. The worker/workflow decides how the active turn is cancelled and whether queued work continues.

## Scheduling From A Client

If the current API exposes scheduled tasks, a client can provide:

- One-shot task creation.
- Interval task creation.
- Calendar-style recurring tasks.
- Run mode selection if supported: new session per run or reusable session.
- Overlap policy if supported.
- Manual trigger, pause/resume, delete, and run history views.

Examples: nightly infrastructure drift scan, weekly repo review, one-shot migration assistant, recurring compliance check, daily reusable investigation thread.

## Client-Side Copy Guidance

Use client-centered language:

- "Create a session, stream events, and send follow-ups through the API."
- "Embed durable agent work into your SaaS without running the agent in your web server."
- "Attach files, repositories, and MCP tool providers to a run."
- "Replay the event log after reloads or network drops."
- "Handle approvals and interrupts as normal API events."

Avoid implying clients call Temporal, NATS, Postgres, the worker, or the sandbox directly.

## Keep This Reference Current

Update this file when:

- Public API route shape changes.
- Contracts for sessions, events, resources, tools, files, or scheduled tasks change.
- SSE replay/reconnect behavior changes.
- Auth/tenancy is added to the base API.
- Client config capabilities change.
- File upload or repository selection flow changes.
- New first-class client SDKs are added.

