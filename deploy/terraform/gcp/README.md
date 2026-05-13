# GCP Reference Substrate

This root creates a cleanup-friendly GCP substrate for the Helm chart:

- GKE cluster and managed node pool with Workload Identity enabled.
- Artifact Registry Docker repository.
- GCS bucket for `OPENGENI_OBJECT_STORAGE_BACKEND=gcs`.
- Secret Manager runtime secret placeholder.
- Runtime service account for Workload Identity, GCS access, Secret Manager access, signed URL generation, and Artifact Registry image pulls.
- Optional Cloud SQL PostgreSQL when `postgres.mode = "managed"`.

Keep OpenGeni workloads in the provider-neutral Helm chart. This root should only create cloud substrate and emit non-secret Helm values.

## Validate

```bash
terraform -chdir=deploy/terraform/gcp init -backend=false
terraform -chdir=deploy/terraform/gcp fmt -check
terraform -chdir=deploy/terraform/gcp validate
```

## Apply

Before creating resources, add planned names, project, region, and cleanup commands to `docs/gcp-resource-ledger.md`.

```bash
terraform -chdir=deploy/terraform/gcp plan -var-file=terraform.tfvars
terraform -chdir=deploy/terraform/gcp apply -var-file=terraform.tfvars
```

Do not commit state, kubeconfigs, generated database passwords, service-account keys, GCP credentials, or filled secret values.
