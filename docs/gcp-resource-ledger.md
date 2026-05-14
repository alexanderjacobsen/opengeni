# GCP Resource Ledger

Track every GCP resource created while developing and verifying the OpenGeni GCP reference deployment. Do not create GCP resources without adding or updating an entry here.

## Rules

- Never include secrets, access keys, kubeconfigs, connection strings with passwords, private key material, or generated service-account keys.
- Prefer cleanup-friendly names and labels.
- Label resources with at least `project=opengeni`, `owner=codex`, and `purpose=deployment-verification` when supported.
- Record the creation command or Terraform module responsible for the resource.
- Record the cleanup command before considering the resource safe to leave temporarily.
- If a command fails because of permissions, quota, billing, region availability, or organization policy, record the blocker here instead of retrying blindly.

## Shutdown Status - 2026-05-14

Shutdown was requested and executed from the public working repo on branch `codex/azure-deployment-platform`.

- The Kubernetes release `opengeni-gcp` was uninstalled and namespace `opengeni-gcp` was deleted.
- Terraform destroy, retried with `GOOGLE_OAUTH_ACCESS_TOKEN` because ADC was expired, deleted the GKE node pool and cluster.
- `gcloud container clusters describe opengeni-codex-8092-gke --region us-central1 --project cloudgeni-gecko` returned `404 Not found`.
- Terraform destroy and direct `gcloud` cleanup were blocked on the remaining non-cluster resources by the active account `terraform-plan-readonly-temp@cloudgeni-gecko.iam.gserviceaccount.com`.
- Remaining resources verified present: VPC `opengeni-codex-8092-vpc`, subnet `opengeni-codex-8092-subnet`, Artifact Registry repo `opengeni-codex-8092-images`, GCS bucket `cloudgeni-gecko-opengeni-codex-8092-files`, Secret Manager secret `opengeni-codex-8092-runtime`, and service account `opengeni-codex-8092-runtime@cloudgeni-gecko.iam.gserviceaccount.com`.
- Missing permissions observed during cleanup: `storage.objects.delete`, `storage.buckets.delete`, `storage.buckets.setIamPolicy`, `artifactregistry.repositories.delete`, `artifactregistry.repositories.setIamPolicy`, `secretmanager.secrets.delete`, `iam.serviceAccounts.delete`, `iam.serviceAccounts.setIamPolicy`, `compute.subnetworks.delete`, `compute.networks.delete`, and project IAM update permissions for Terraform-managed IAM members.

## Resources

| Status | Resource Type | Name | Project/Region | Purpose | Created By | Cleanup Command | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| delete-blocked | GCP reference substrate | `opengeni-codex-8092-*` | `cloudgeni-gecko/us-central1` | GKE/Artifact Registry/GCS/Secret Manager/observability verification | `deploy/terraform/gcp` | `terraform -chdir=deploy/terraform/gcp destroy -var-file=terraform.tfvars -var project_id=cloudgeni-gecko` | Terraform deleted GKE but failed on remaining resources because the active account lacks delete/IAM permissions listed in the shutdown status. |
| deleted | GKE cluster | `opengeni-codex-8092-gke` | `cloudgeni-gecko/us-central1` | Kubernetes workload plane | `deploy/terraform/gcp` | Destroy Terraform root above or `gcloud container clusters delete opengeni-codex-8092-gke --region us-central1 --project cloudgeni-gecko --quiet`. | Deleted by Terraform destroy; `gcloud container clusters describe` returned 404. |
| delete-blocked | Artifact Registry repository | `opengeni-codex-8092-images` | `cloudgeni-gecko/us-central1` | Workload image registry | `deploy/terraform/gcp` | Destroy Terraform root above or `gcloud artifacts repositories delete opengeni-codex-8092-images --location us-central1 --project cloudgeni-gecko --quiet`. | Direct delete failed with missing `artifactregistry.repositories.delete`; Terraform also lacked `artifactregistry.repositories.setIamPolicy`. |
| delete-blocked | GCS bucket | `cloudgeni-gecko-opengeni-codex-8092-files` | `cloudgeni-gecko/us-central1` | Native GCS file storage | `deploy/terraform/gcp` | Destroy Terraform root above or `gcloud storage rm -r --all-versions gs://cloudgeni-gecko-opengeni-codex-8092-files`. | Direct delete failed with missing `storage.objects.delete` and `storage.buckets.delete`; Terraform also lacked `storage.buckets.setIamPolicy`. |
| delete-blocked | Secret Manager secret | `opengeni-codex-8092-runtime` | `cloudgeni-gecko/global` | Runtime secret storage | `deploy/terraform/gcp` | Destroy Terraform root above or `gcloud secrets delete opengeni-codex-8092-runtime --project cloudgeni-gecko --quiet`. | Direct delete failed with missing `secretmanager.secrets.delete`. Placeholder secret only; no committed secret values. |
| delete-blocked | GCP service account | `opengeni-codex-8092-runtime@cloudgeni-gecko.iam.gserviceaccount.com` | `cloudgeni-gecko/global` | GKE workload identity for runtime access | `deploy/terraform/gcp` | Destroy Terraform root above or `gcloud iam service-accounts delete opengeni-codex-8092-runtime@cloudgeni-gecko.iam.gserviceaccount.com --project cloudgeni-gecko --quiet`. | Direct delete failed with missing `iam.serviceAccounts.delete`; Terraform also lacked `iam.serviceAccounts.setIamPolicy`. |
| delete-blocked | Artifact Registry images | `opengeni-api`, `opengeni-worker`, `opengeni-web` tag `gcp-smoke-8802d70-20260513134906` | `cloudgeni-gecko/us-central1` | GKE smoke workload images | `docker buildx build` and `docker push` | Destroy Terraform root above with the repository or delete the tag/images from Artifact Registry. | Repository deletion is blocked by missing Artifact Registry delete permissions. |
| deleted | Kubernetes namespace | `opengeni-gcp` | `opengeni-codex-8092-gke/us-central1` | GCP live smoke deployment | `kubectl create namespace opengeni-gcp` | `kubectl delete namespace opengeni-gcp`. | Deleted before the GKE cluster was destroyed. |
| deleted | Helm release | `opengeni-gcp` | `opengeni-gcp` namespace | OpenGeni API/web/worker plus in-cluster Postgres, Temporal, NATS, and OTel Collector | `helm upgrade --install opengeni-gcp deploy/helm/opengeni ...` | `helm uninstall opengeni-gcp --namespace opengeni-gcp`. | Uninstalled before namespace deletion. |
| deleted | Kubernetes Secret | `opengeni-runtime-gcp` | `opengeni-gcp` namespace | Runtime model and storage settings for smoke deployment | `kubectl create secret generic opengeni-runtime-gcp --from-env-file=/tmp/opengeni-gcp-runtime.env` | Deleted with namespace or `kubectl -n opengeni-gcp delete secret opengeni-runtime-gcp`. | Values came from local ignored env files and were not committed. |
| delete-blocked | GCS conformance object | `files/c0d19aba-a262-4b75-a0df-2dee57a65461/original/conformance.txt` | `cloudgeni-gecko-opengeni-codex-8092-files` | Native GCS upload/download conformance | `bun run deployment:conformance` | Destroy bucket or `gcloud storage rm --all-versions gs://cloudgeni-gecko-opengeni-codex-8092-files/files/c0d19aba-a262-4b75-a0df-2dee57a65461/original/conformance.txt`. | Object deletion failed with missing `storage.objects.delete`. |

## Verification Notes

- `terraform -chdir=deploy/terraform/gcp apply /tmp/opengeni-gcp-artifact-reader.tfplan` added `roles/artifactregistry.reader` for the runtime service account after GKE image pulls failed with Artifact Registry `403 Forbidden`.
- Successful GKE conformance run: `bun run deployment:conformance -- --base-url http://127.0.0.1:38080 --timeout-seconds 180 --json`.
- Successful conformance session: `dd9f3357-d6ca-4ca8-88b9-211cc002e313`; scheduled-task session: `2e3abb43-0117-4c22-8035-1e7997b96dd1`; file: `c0d19aba-a262-4b75-a0df-2dee57a65461`.
