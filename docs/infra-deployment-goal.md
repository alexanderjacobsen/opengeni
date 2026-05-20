# OpenGeni Infrastructure Goal

This file is the source of truth for the infrastructure work. Keep it current as deployment behavior changes, and do not treat the work as complete until every required gate is satisfied with evidence.

## End Goal

OpenGeni is ready for an open-source pull request that adds a robust, cloud-provider-agnostic, production-grade deployment platform and proves it works locally plus in Azure, AWS, and GCP reference environments.

The final state must support:

- Docker Compose full-stack development.
- Local Kubernetes development and conformance through the same Helm chart used in cloud verification.
- Kubernetes as the default workload plane for API, web, worker, migrations, telemetry collection, and optional smoke fixtures.
- Azure, AWS, and GCP reference substrate definitions with clean naming, tagging/labeling, public-safe ledgers, and cleanup commands.
- Existing customer Postgres and Temporal endpoints, not only newly provisioned resources.
- Managed, external, and in-cluster modes where the primitive supports those modes.
- A deterministic deployment contract shared by docs, Helm, Terraform, CI, preflight, and conformance checks.
- PR and manual branch preview deployments with deterministic teardown and conformance checks.
- OpenTelemetry as the backend-agnostic observability contract, with Prometheus-compatible metrics, structured logs, traces, and documented adapters to self-hosted or managed backends.
- Clean, compact infra/deployment docs and agent guidance.
- A public-ready repository with no secrets, cloud account identifiers, public IPs, kubeconfigs, Terraform state, or customer-specific values committed.

## Non-Negotiable Constraints

- Do not commit secrets, local `.env` files, generated credentials, kubeconfigs, Terraform state, public cloud account identifiers, public IPs, or customer-specific values.
- Do not print secret values to logs or final answers.
- Track every cloud resource class created for this work in the provider ledger:
  - Azure: `docs/azure-resource-ledger.md`
  - AWS: `docs/aws-resource-ledger.md`
  - GCP: `docs/gcp-resource-ledger.md`
- Keep exact private cleanup transcripts and generated resource identifiers outside the public repository.
- Prefer least-privilege cloud identities and short-lived credentials.
- Treat sandbox credential exposure as explicit opt-in through preparation profiles and allowlists.
- Preserve OpenGeni's runtime architecture: API is the public surface, Postgres is durable truth, NATS is live fanout, Temporal is orchestration, workers own side effects, and sandboxes are isolated execution environments.
- Keep provider-specific infrastructure separated from the provider-neutral Kubernetes app layer.
- Use official upstream charts/operators or managed services for production platform dependencies whenever mature options exist.
- Treat OpenGeni-owned Postgres, Temporal, NATS, and MinIO templates as disposable verification fixtures only. They are acceptable for local development, CI, previews, and smoke tests, but are not production-grade alternatives.

## Required Capabilities

- Kubernetes workload primitives: startup/readiness/liveness probes, PDBs, topology spread, autoscaling hooks, service accounts, optional cloud identity annotations, security contexts, resource defaults, and network policies.
- Postgres with pgvector for sessions, event log, documents, and indexes.
- Temporal endpoint, namespace, task queue, and worker connectivity.
- NATS endpoint for live fanout, with durable replay backed by Postgres.
- Official production dependency integrations:
  - NATS through the official NATS Helm chart or an existing managed/customer endpoint.
  - Temporal through Temporal Cloud, an existing endpoint, or the official Temporal Helm chart connected to production persistence.
  - Postgres through managed cloud Postgres, an existing database, or a production-grade operator such as CloudNativePG.
  - Secrets through External Secrets Operator, cloud-native secret stores, Vault, or an equivalent operator-managed path.
  - TLS through cert-manager, cloud load balancer integrations, or an existing ingress/TLS stack.
  - Observability through OpenTelemetry Collector/Operator, Prometheus-compatible metrics, and documented backend choices.
- Object storage adapters for Azure Blob, AWS S3, Google Cloud Storage, and S3-compatible local/self-contained modes.
- Ingress/TLS guidance with long-lived SSE support and safe timeouts.
- Container registry and immutable image references.
- Sandbox backend selection and readiness verification.
- Backup, restore, retention, and cleanup expectations for durable data.
- Temporary shared-key access boundary for deployment smoke and early self-hosted use, plus gateway guidance for real auth, tenancy, RBAC, SSO, and rate limiting.
- Preview lifecycle: namespace naming, image tag selection, Helm values generation, URL/DNS/TLS strategy, conformance execution, TTL/teardown, and cost controls.
- Concise README, SECURITY, deployment docs, AGENTS notes, and OpenGeni skill guidance that point operators and future agents to current source files.

## Target Profiles

- `local-compose`
- `local-kubernetes`
- `kubernetes-external`
- `azure-managed`
- `azure-existing-services`
- `aws-managed`
- `aws-existing-services`
- `gcp-managed`
- `gcp-existing-services`
- `preview-pr`
- `preview-branch`
- `self-contained-kubernetes`

## Architecture Decision

OpenGeni should not build a bespoke platform controller in this PR. The deployment platform is split into:

- **Provider-neutral app layer:** Helm chart plus preflight/conformance scripts define the OpenGeni workload contract.
- **Provider-specific substrate layer:** Terraform/OpenTofu roots create cloud primitives and produce non-secret Helm values.
- **Official dependency layer:** production NATS, Temporal, Postgres, secret sync, ingress/TLS, and observability are installed or referenced through managed services or upstream charts/operators. Wrapper stack plans may install upstream charts and generate endpoint wiring, but those charts are not dependencies of the OpenGeni app chart.
- **Preview/GitOps layer:** immutable images and generated values are deployable by GitHub Actions, Argo CD ApplicationSets, Flux, or manual Helm.
- **Observability layer:** OpenTelemetry is the stable contract; export can target a self-hosted LGTM-compatible stack or managed cloud observability.
- **Secret layer:** local smoke may use Kubernetes Secrets; production should use External Secrets Operator or cloud-native workload identity with provider secret stores.

## Verification Gates

The work is not complete until all applicable gates pass or have an explicit, acceptable skip reason:

- `bun install --frozen-lockfile`
- `bun run typecheck`
- `bun test`
- `bun run check`
- `bun run test:integration`
- Web production build
- Local full-stack smoke through `bun run dev`
- Local Kubernetes conformance through Helm
- Deployment profile validation for every target profile
- Helm lint/template/schema validation
- Terraform fmt/validate/plan for Azure, AWS, and GCP roots
- Preflight against existing Postgres and Temporal modes
- Azure, AWS, and GCP smoke/conformance
- API health, session run, worker turn, event replay, SSE replay, and scheduled task dispatch
- Azure Blob, S3, and GCS API upload/download without MinIO in managed cloud profiles
- Sandbox backend readiness and credential-hygiene checks
- Observability checks for logs, metrics, traces, and labels
- Security checks: secret scan, no committed credentials, explicit sandbox env allowlist, and network-policy review
- Preview environment create/update/destroy verification
- Cleanup verification for temporary Azure, AWS, and GCP resources

## PR-Ready Definition

The final change is ready to merge when:

- Required gates pass.
- Provider ledgers are complete, public-safe, and all temporary resources are deleted or intentionally retained.
- README, SECURITY, AGENTS, deployment docs, and skills match implemented behavior.
- Operator-facing docs are compact and current; long private evidence stays out of public docs.
- CI covers source validation without requiring live cloud credentials.
- Preview workflows are safely gated so forks and untrusted PRs cannot access production secrets.
- Azure, AWS, and GCP reference paths are reproducible from a clean checkout plus documented credentials.
- No untracked required artifacts exist.
- The diff contains no unrelated refactors or generated noise.

## Current Status

- Status: implementation in progress for the open-source deployment platform hardening pass.
- Completed locally: shared-key smoke auth, authenticated web/SSE client path, stack-profile dry-runs, ledger validation, Helm/Terraform validation, and local Kubernetes conformance with teardown evidence.
- Completed live: GCP managed conformance against GKE, private Cloud SQL, Artifact Registry, GCS, wrapper-managed NATS, wrapper-managed Temporal, and port-forwarded OpenGeni; AWS managed conformance against EKS, RDS, ECR, S3, wrapper-managed NATS, wrapper-managed Temporal, and port-forwarded OpenGeni; Azure managed conformance against AKS, Azure PostgreSQL, ACR, Azure Blob, wrapper-managed NATS, wrapper-managed Temporal, and port-forwarded OpenGeni.
- Live findings folded back into implementation: GCP Cloud SQL private IP and explicit edition handling; GKE verification node-location control; GCS public access prevention; Temporal namespace registration; AWS RDS TLS/CA handling for Temporal; encrypted AWS RDS application database URLs; Azure PostgreSQL region/name/zone controls; Azure PostgreSQL `BTREE_GIN` extension allowlist for Temporal visibility; ACR exposed-token Docker login fallback.
- Remaining before PR-ready: none known. Live cloud resources remain intentionally retained per operator instruction and should be destroyed later from the tracked private state/ledger commands.

## Public Evidence Log

- Added deployment contract package and profile/preflight/conformance scripts.
- Added production-oriented Helm chart for API, worker, web, migrations, telemetry, and smoke-only optional fixtures.
- Added Terraform reference roots for Azure, AWS, and GCP substrate resources.
- Added provider-native object storage support for Azure Blob, AWS S3, and GCS.
- Added OpenTelemetry metrics/tracing/log correlation package and Helm collector support.
- Added CI validation for deployment profiles, Helm rendering, Terraform validation, workflow syntax, image builds, and floating-tag guards.
- Added preview workflow with secret-aware create/update/destroy behavior.
- Verified local Kubernetes conformance during private validation and retained teardown evidence.
- Verified GCP managed, AWS managed, and Azure managed live conformance during private validation; temporary resources remain intentionally retained per operator instruction and are tracked in provider ledgers.
- Verified existing-service behavior by deploying an app-only smoke release against already-running AWS externalized dependencies; no Terraform or platform dependency lifecycle was invoked, conformance passed, and only the smoke Helm release was removed.

## Remaining Operator Actions

- For a real long-lived deployment, install or connect production Postgres, Temporal, NATS, secret sync, TLS/ingress, and observability backends.
- Enable built-in shared-key auth for exposed smoke/self-hosted deployments, and put OpenGeni behind a production auth/gateway boundary before exposing it to untrusted users long term.
- Pin images by digest and run the conformance suite after every deployment.
