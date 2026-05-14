# Infrastructure Completion Audit

This audit maps the infrastructure goal to public-safe evidence. Private cloud identifiers, exact generated resource names, public IPs, account IDs, project IDs, object keys, session IDs, and cleanup transcripts are intentionally not committed.

## Objective

Bring OpenGeni to PR-ready production deployment quality: Docker Compose, local Kubernetes, Azure/AWS/GCP reference paths, existing service support, provider-native object storage, official production dependency boundaries, OpenTelemetry-based observability, preview lifecycle automation, compact docs, and cleanup of all temporary verification resources.

## Prompt-To-Artifact Checklist

| Requirement | Evidence | Status | Notes |
| --- | --- | --- | --- |
| Repo-owned goal file | `docs/infra-deployment-goal.md` | done | Defines target architecture, required gates, source artifacts, and final status. |
| Cloud resource cleanup | `docs/azure-resource-ledger.md`, `docs/aws-resource-ledger.md`, `docs/gcp-resource-ledger.md` | done | Public-safe ledgers record resource classes and deletion status. Exact provider identifiers are kept out of the public repository. |
| Cloud-provider-agnostic deployment contract | `packages/deployment/src/index.ts`, `scripts/deployment-preflight.ts`, `scripts/deployment-conformance.ts` | done | Profiles and checks cover local, Kubernetes, Azure, AWS, GCP, existing-service, and preview modes. |
| Production dependency boundary | `docs/deployment.md`, `AGENTS.md`, Helm examples, CI checks | done | Production dependencies are managed services, existing endpoints, or official upstream charts/operators. Chart-owned Postgres, Temporal, NATS, and MinIO are labeled smoke/local fixtures only. |
| Existing Postgres and Temporal | Deployment profiles and Terraform inputs | done | Existing endpoint mode is modeled and preflighted. |
| Provisioned services | Terraform roots and Helm chart | done | Azure managed Postgres proof passed; cloud object stores are provider-native; self-hosted Temporal/NATS are delegated to official upstream or existing services for production. |
| Local verification | Docker Compose, sandbox image, conformance suite | done | Fast checks, integration checks, local stack smoke, sandbox file flow, and credential-hygiene checks passed during the private verification pass. |
| Local Kubernetes verification | `deploy/helm/opengeni` | done | Same Helm chart ran locally with in-cluster smoke fixtures and passed conformance. |
| Azure reference path | `deploy/terraform/azure`, Helm Azure examples, Azure ledger | done | AKS, ACR, Key Vault, Azure Blob, managed Postgres proof, ingress/TLS smoke, observability, and conformance were verified before shutdown. |
| AWS reference path | `deploy/terraform/aws`, Helm AWS example, AWS ledger | done | EKS, ECR, S3, Secrets Manager, IRSA, EBS CSI, observability, and conformance were verified before shutdown. |
| GCP reference path | `deploy/terraform/gcp`, Helm GCP example, GCP ledger | done | GKE, Artifact Registry, GCS, Secret Manager, Workload Identity, observability, and conformance were verified before shutdown. |
| Object storage adapters | `packages/storage`, `packages/runtime`, conformance suite | done | Azure Blob, AWS S3, GCS, and S3-compatible local storage paths are implemented and verified for API upload/download; sandbox file materialization/mount paths were verified where applicable. |
| Observability | `packages/observability`, Helm collector templates, `/metrics`, docs | done | OpenTelemetry spans/log correlation, Prometheus metrics, collector rendering, and dashboard/alert guidance are implemented or documented. |
| Security hardening | Dockerfile, Helm security contexts, network policies, docs, secret scan | done | App images run non-root, chart values include security primitives, sandbox credential exposure is opt-in, and public artifacts contain placeholders rather than credentials. |
| CI/CD and previews | `.github/workflows/ci.yml`, `.github/workflows/preview.yml` | done | CI validates deployment artifacts and image builds. Preview workflow is gated so PR previews skip when secrets are unavailable and manual previews fail fast if required secrets are missing. |
| Public-history transfer | Permanent public clone | done | Work is on the clean public-history branch, not the old private-history repository. |
| Completion proof | This audit and green PR checks | done | Local/static gates passed before PR creation, GitHub checks are green, and all temporary cloud resources were shut down. |

## Verified Gates

- `bun install --frozen-lockfile`
- `bun run check`
- `bun run test:integration`
- `bun run deployment:profiles`
- Deployment preflight for Azure/AWS/GCP managed and existing-services profiles plus preview profiles
- Helm lint/template rendering with digest-pinned images and provider examples
- GitHub Actions lint for CI and preview workflows
- Floating `latest` image guard for deployment artifacts
- `git diff --check`
- Terraform fmt/init/validate for Azure, AWS, and GCP roots
- Targeted committed-secret scan
- API health, metrics, session run, event replay, SSE replay, scheduled task dispatch, and provider-native object storage upload/download in local, local Kubernetes, Azure, AWS, and GCP verification environments

## Shutdown Proof

All temporary Azure, AWS, and GCP verification resources were shut down on 2026-05-14. The public ledgers now retain only sanitized resource classes and cleanup status so the open-source PR does not leak provider account details.

## Residual Operator Notes

- For a real long-lived deployment, replace smoke-only in-cluster Postgres/Temporal/NATS/MinIO with managed services, existing customer services, or official upstream operators/charts.
- Put OpenGeni behind a production auth/gateway boundary before exposing it to untrusted users.
- Use External Secrets Operator or provider-native workload identity for production secret delivery.
- Pin workload images by digest and run conformance after every deployment.
