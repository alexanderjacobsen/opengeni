# GCP Resource Ledger

Track every GCP resource created while developing and verifying the OpenGeni GCP reference deployment. Do not create GCP resources without adding or updating an entry here.

## Rules

- Never include secrets, access keys, kubeconfigs, connection strings with passwords, private key material, or generated service-account keys.
- Prefer cleanup-friendly names and labels.
- Label resources with at least `project=opengeni`, `owner=codex`, and `purpose=deployment-verification` when supported.
- Record the creation command or Terraform module responsible for the resource.
- Record the cleanup command before considering the resource safe to leave temporarily.
- If a command fails because of permissions, quota, billing, region availability, or organization policy, record the blocker here instead of retrying blindly.

## Resources

| Status | Resource Type | Name | Project/Region | Purpose | Created By | Cleanup Command | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| created | GCP reference substrate | `opengeni-codex-8092-*` | `cloudgeni-gecko/us-central1` | GKE/Artifact Registry/GCS/Secret Manager/observability verification | `deploy/terraform/gcp` | `terraform -chdir=deploy/terraform/gcp destroy -var-file=terraform.tfvars -var project_id=cloudgeni-gecko` | Created by Terraform apply from `/tmp/opengeni-gcp.tfplan`. Temporary tfvars set GKE deletion protection false and GCS force destroy true for cleanup. |
| created | GKE cluster | `opengeni-codex-8092-gke` | `cloudgeni-gecko/us-central1` | Kubernetes workload plane | `deploy/terraform/gcp` | Destroy Terraform root above or `gcloud container clusters delete opengeni-codex-8092-gke --region us-central1 --project cloudgeni-gecko --quiet`. | Created with Workload Identity enabled and node pool `system`. |
| created | Artifact Registry repository | `opengeni-codex-8092-images` | `cloudgeni-gecko/us-central1` | Workload image registry | `deploy/terraform/gcp` | Destroy Terraform root above or `gcloud artifacts repositories delete opengeni-codex-8092-images --location us-central1 --project cloudgeni-gecko --quiet`. | Docker repository for OpenGeni workload images. |
| created | GCS bucket | `cloudgeni-gecko-opengeni-codex-8092-files` | `cloudgeni-gecko/us-central1` | Native GCS file storage | `deploy/terraform/gcp` | Destroy Terraform root above or `gcloud storage rm -r gs://cloudgeni-gecko-opengeni-codex-8092-files`. | Uniform bucket-level access and versioning enabled; force destroy is true in verification tfvars. |
| created | Secret Manager secret | `opengeni-codex-8092-runtime` | `cloudgeni-gecko/global` | Runtime secret storage | `deploy/terraform/gcp` | Destroy Terraform root above or `gcloud secrets delete opengeni-codex-8092-runtime --project cloudgeni-gecko --quiet`. | Placeholder secret only; no committed secret values. |
| created | GCP service account | `opengeni-codex-8092-runtime@cloudgeni-gecko.iam.gserviceaccount.com` | `cloudgeni-gecko/global` | GKE workload identity for runtime access | `deploy/terraform/gcp` | Destroy Terraform root above or `gcloud iam service-accounts delete opengeni-codex-8092-runtime@cloudgeni-gecko.iam.gserviceaccount.com --project cloudgeni-gecko --quiet`. | Granted access to the runtime secret, GCS bucket, IAM signing for GCS V4 URLs, Workload Identity impersonation from `opengeni-gcp/opengeni-gcp`, and Artifact Registry image pulls. |
| created | Artifact Registry images | `opengeni-api`, `opengeni-worker`, `opengeni-web` tag `gcp-smoke-8802d70-20260513134906` | `cloudgeni-gecko/us-central1` | GKE smoke workload images | `docker buildx build` and `docker push` | Destroy Terraform root above with the repository or delete the tag/images from Artifact Registry. | API digest `sha256:99034325c9cc9ee2bd559cf50fb450f546d767b0c0c3cc6aa7b9bd654dfd1feb`; worker digest `sha256:9e31020c9c5ba5bae74b9211e31d61e597ebb9e7eee9daa338f982588bad58ad`; web digest `sha256:68bba0c854ac772a4a23f3779c581cdaae8539d2f36eab5f81332b9e71da590b`. |
| created | Kubernetes namespace | `opengeni-gcp` | `opengeni-codex-8092-gke/us-central1` | GCP live smoke deployment | `kubectl create namespace opengeni-gcp` | `kubectl delete namespace opengeni-gcp`. | Contains the Helm release, in-cluster smoke dependencies, and runtime secret for verification only. |
| created | Helm release | `opengeni-gcp` | `opengeni-gcp` namespace | OpenGeni API/web/worker plus in-cluster Postgres, Temporal, NATS, and OTel Collector | `helm upgrade --install opengeni-gcp deploy/helm/opengeni ...` | `helm uninstall opengeni-gcp --namespace opengeni-gcp`. | Deployed with GCS object storage, Workload Identity, the image tag above, `postgres.enabled=true`, `temporal.enabled=true`, `nats.enabled=true`, and `minio.enabled=false`. |
| created | Kubernetes Secret | `opengeni-runtime-gcp` | `opengeni-gcp` namespace | Runtime model and storage settings for smoke deployment | `kubectl create secret generic opengeni-runtime-gcp --from-env-file=/tmp/opengeni-gcp-runtime.env` | Deleted with namespace or `kubectl -n opengeni-gcp delete secret opengeni-runtime-gcp`. | Values came from local ignored env files and were not committed. |
| created | GCS conformance object | `files/c0d19aba-a262-4b75-a0df-2dee57a65461/original/conformance.txt` | `cloudgeni-gecko-opengeni-codex-8092-files` | Native GCS upload/download conformance | `bun run deployment:conformance` | Destroy bucket or `gcloud storage rm gs://cloudgeni-gecko-opengeni-codex-8092-files/files/c0d19aba-a262-4b75-a0df-2dee57a65461/original/conformance.txt`. | Created during the successful GKE conformance run. |

## Verification Notes

- `terraform -chdir=deploy/terraform/gcp apply /tmp/opengeni-gcp-artifact-reader.tfplan` added `roles/artifactregistry.reader` for the runtime service account after GKE image pulls failed with Artifact Registry `403 Forbidden`.
- Successful GKE conformance run: `bun run deployment:conformance -- --base-url http://127.0.0.1:38080 --timeout-seconds 180 --json`.
- Successful conformance session: `dd9f3357-d6ca-4ca8-88b9-211cc002e313`; scheduled-task session: `2e3abb43-0117-4c22-8035-1e7997b96dd1`; file: `c0d19aba-a262-4b75-a0df-2dee57a65461`.
