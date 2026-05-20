# GCP Reference Substrate

This root creates a cleanup-friendly GCP substrate for the Helm chart:

- GKE cluster and managed node pool with Workload Identity enabled.
- Artifact Registry Docker repository.
- GCS bucket for `OPENGENI_OBJECT_STORAGE_BACKEND=gcs`, with uniform bucket-level access and public access prevention.
- Secret Manager runtime secret placeholder.
- Runtime service account for Workload Identity, GCS access, Secret Manager access, signed URL generation, and Artifact Registry image pulls.
- Optional Cloud SQL PostgreSQL when `postgres.mode = "managed"`.
- Private Service Connect / service networking for managed Cloud SQL when `postgres.private_ip_enabled = true`.
- `temporal.mode = "officialChart"` output wiring for the stack-wrapper managed upstream Temporal chart, or `external` for Temporal Cloud/customer endpoints.

Keep OpenGeni workloads in the provider-neutral Helm chart. This root should only create cloud substrate and emit non-secret Helm values.

Managed Postgres defaults to `edition = "ENTERPRISE"` and `availability_type = "REGIONAL"` for production resilience. Temporary verification stacks can set `postgres.availability_type = "ZONAL"` with `deletion_protection = false` to reduce cost and speed up teardown.

Regional GKE clusters distribute node pools across zones by default. Temporary verification stacks can set `gke.node_locations = ["<zone>"]` and smaller node counts to avoid creating one node group per zone; omit `node_locations` for production multi-zone resilience.

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
The official Temporal chart still needs durable Postgres databases prepared outside the OpenGeni app chart before Helm install.
