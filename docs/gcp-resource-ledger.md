# GCP Resource Ledger

Track GCP resources created while developing and verifying the OpenGeni GCP reference deployment. Keep this file public-safe: do not record project IDs, generated service-account emails, generated resource IDs, public IPs, generated credentials, kubeconfigs, or account-specific object names.

## Rules

- Never include secrets, access keys, kubeconfigs, connection strings with passwords, private key material, public IPs, project IDs, generated service-account identities, or generated service-account keys.
- Prefer cleanup-friendly names and labels.
- Label resources with at least `project=opengeni`, `owner=codex`, and `purpose=deployment-verification` when supported.
- Record the Terraform root, script, or operator command class responsible for the resource.
- Record cleanup status before considering the resource safe to leave temporarily.
- Keep exact private cleanup transcripts outside the public repository.

## Shutdown Status - 2026-05-14

Shutdown was requested and completed. The temporary GCP Helm release and namespace were removed, the GKE cluster was deleted, and follow-up cleanup with an account that had the required permissions deleted the remaining non-cluster resources. Verification after cleanup returned not found or empty filtered lists for the temporary cluster, network, subnet, Artifact Registry repository, GCS bucket, Secret Manager secret, and runtime service account.

## Resources

| Status | Resource Type | Scope | Purpose | Created By | Cleanup Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| delete_requested | GCP verification project | Cloudgeni organization | Isolated OpenGeni world-class deployment verification across GKE, Artifact Registry, GCS, Secret Manager, IAM, and observability | Direct `gcloud` project bootstrap, then `deploy/terraform/gcp` | Project deletion requested after user-approved teardown on 2026-05-24 | Billing linked, cleanup labels applied, and required APIs enabled during verification. Cleanup now reports project lifecycle `DELETE_REQUESTED`. Exact project id and billing account are tracked outside public docs in `.agent/cloud-resource-ledger.md`. |
| delete_requested | GCP managed live verification stack | Verification project and region | Live managed-stack conformance across GKE, Artifact Registry, Cloud SQL private IP, GCS, Secret Manager, IAM, upstream NATS/Temporal charts, OpenGeni Helm, auth, and teardown evidence | `deploy/terraform/gcp`, `deploy/stacks`, Helm, and conformance scripts | Project deletion requested after user-approved teardown on 2026-05-24 | Terraform deleted GCS, Artifact Registry, Secret Manager, IAM, GKE node pool, GKE cluster, and subnet; direct Cloud SQL instance deletion then succeeded; the isolated verification project is now in `DELETE_REQUESTED`. Exact private cleanup evidence remains in `.agent/cloud-resource-ledger.md` and `.agent/progress.md`. |
| deleted | GCP reference substrate | Verification project and region | GKE, Artifact Registry, GCS, Secret Manager, network, IAM, and observability verification | `deploy/terraform/gcp` | Destroyed by Terraform plus direct follow-up cleanup | Terraform removed the cluster path; direct cleanup removed resources initially blocked by narrower permissions. |
| deleted | GKE cluster and node pool | Verification project and region | Kubernetes workload plane | `deploy/terraform/gcp` | Deleted during shutdown | Used for Helm and conformance verification. |
| deleted | Artifact Registry repository and images | Verification project and region | Workload image registry | `deploy/terraform/gcp` plus local image pushes | Deleted during shutdown | Included temporary API, worker, and web verification images. |
| deleted | GCS bucket and conformance objects | Verification project and region | Native GCP object storage verification | `deploy/terraform/gcp` and conformance suite | Deleted during shutdown | Uniform bucket-level access, versioning, and GCS upload/download were verified. |
| deleted | Secret Manager secret | Verification project | Runtime secret store reference | `deploy/terraform/gcp` | Deleted during shutdown | No secret values were committed. |
| deleted | Runtime service account and IAM bindings | Verification project | GKE Workload Identity and storage access | `deploy/terraform/gcp` | Deleted during shutdown | Verified workload identity and object storage access paths. |
| deleted | VPC and subnet | Verification project and region | GKE network substrate | `deploy/terraform/gcp` | Deleted during shutdown | Verification network was cleanup-labeled. |
| deleted | Kubernetes namespace, Helm release, runtime secret, and PVCs | GKE cluster | OpenGeni conformance deployment | Helm and kubectl | Deleted before cluster cleanup | Conformance verified API health, metrics, session run, event replay, SSE replay, scheduled task dispatch, and GCS upload/download. |
