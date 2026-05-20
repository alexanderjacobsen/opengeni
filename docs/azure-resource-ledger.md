# Azure Resource Ledger

Track Azure resources created while developing and verifying the OpenGeni Azure reference deployment. Keep this file public-safe: do not record subscription IDs, tenant IDs, public IPs, generated credentials, kubeconfigs, private endpoint hostnames, or account-specific object names.

## Rules

- Never include secrets, access keys, kubeconfigs, connection strings with passwords, private key material, public IPs, or private account identifiers.
- Prefer cleanup-friendly names and tags.
- Tag resources with at least `project=opengeni`, `owner=codex`, and `purpose=deployment-verification` when supported.
- Record the Terraform root, script, or operator command class responsible for the resource.
- Record cleanup status before considering the resource safe to leave temporarily.
- Keep exact private cleanup transcripts outside the public repository.

## Shutdown Status - 2026-05-14

Shutdown was requested and completed. The temporary Azure verification resource group and the AKS-managed resource group were deleted, and follow-up Azure CLI checks returned no matching resources for the verification prefix.

The previous public HTTP/TLS smoke endpoints are no longer reachable because the backing LoadBalancer and cluster were deleted.

## Resources

| Status | Resource Type | Scope | Purpose | Created By | Cleanup Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| deleted | Resource group | Verification resource group | Container for Azure substrate | `deploy/terraform/azure` | Deleted with resource-group cleanup | Contained AKS, ACR, Key Vault, storage, and temporary managed Postgres proof resources. |
| deleted | AKS cluster | Verification resource group | Kubernetes workload plane | `deploy/terraform/azure` | Deleted with resource-group cleanup | Used for Helm, ingress, observability, Azure Blob, and conformance verification. |
| deleted | AKS-managed resources | AKS-managed resource group | LoadBalancer, node resources, and persistent disks | AKS cloud controller | Deleted with AKS/resource-group cleanup | Included temporary ingress public IP and smoke PVC disks. |
| deleted | Azure Container Registry | Verification resource group | Workload image registry | `deploy/terraform/azure` plus local image pushes | Deleted with resource-group cleanup | Included temporary API, worker, and web verification images. |
| deleted | Azure Key Vault | Verification resource group | Runtime secret store reference | `deploy/terraform/azure` | Deleted with resource-group cleanup | No secret values were committed. |
| deleted | Azure Storage account and Blob container | Verification resource group | Azure Blob object storage verification | `deploy/terraform/azure` plus direct Azure CLI proof commands | Deleted with resource-group cleanup | Private blob access, versioning, and retention behavior were verified. |
| deleted | Azure Database for PostgreSQL Flexible Server | Verification resource group | Managed Postgres and pgvector proof | Direct Azure CLI proof commands | Deleted before final shutdown | OpenGeni migrations and required extensions were verified, then the server was deleted to avoid ongoing cost. |
| skipped | AKS kubelet ACR pull role assignment | Verification resource group | Preferred long-lived image-pull path | `deploy/terraform/azure` | Not created | Current verification identity lacked role-assignment write permission; the chart was verified with a short-lived fallback pull credential. |
| deleted | Kubernetes namespace, Helm releases, secrets, and PVCs | AKS cluster | Application, ingress, runtime secret, and smoke dependency verification | Helm and kubectl | Deleted before or with cluster cleanup | Included OpenGeni, ingress-nginx, runtime secrets, and smoke-only in-cluster dependency resources. |
| active | Azure managed live verification stack | Verification resource group | AKS, ACR, Key Vault, Azure Blob, managed PostgreSQL, wrapper-managed NATS/Temporal, and OpenGeni live conformance | `deploy/terraform/azure` with private local state plus Helm stack wrapper | Pending user-approved teardown after verification | Planned/started 2026-05-20. Exact subscription, generated names, cluster credentials, state, and secrets are tracked only in `.agent/cloud-resource-ledger.md` and `.agent/generated/azure-managed-live/`. |
