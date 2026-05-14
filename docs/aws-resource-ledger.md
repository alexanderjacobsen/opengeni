# AWS Resource Ledger

Track AWS resources created while developing and verifying the OpenGeni AWS reference deployment. Keep this file public-safe: do not record AWS account IDs, ARNs, generated resource IDs, public IPs, generated credentials, kubeconfigs, or account-specific object names.

## Rules

- Never include secrets, access keys, kubeconfigs, connection strings with passwords, private key material, public IPs, account IDs, ARNs, or generated service credentials.
- Prefer cleanup-friendly names and tags.
- Tag resources with at least `project=opengeni`, `owner=codex`, and `purpose=deployment-verification` when supported.
- Record the Terraform root, script, or operator command class responsible for the resource.
- Record cleanup status before considering the resource safe to leave temporarily.
- Keep exact private cleanup transcripts outside the public repository.

## Shutdown Status - 2026-05-14

Shutdown was requested and completed. The temporary AWS Helm release and namespace were removed, Terraform destroy completed successfully, Terraform state was empty afterward, and follow-up AWS CLI checks confirmed the temporary EKS cluster, ECR repositories, S3 bucket, Secrets Manager entry, VPC, and related tagged resources were gone.

## Resources

| Status | Resource Type | Scope | Purpose | Created By | Cleanup Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| deleted | AWS reference substrate | Verification account and region | EKS, ECR, S3, Secrets Manager, network, IAM, and observability verification | `deploy/terraform/aws` | Destroyed by Terraform | The full Terraform root was applied and then destroyed. |
| deleted | EKS cluster and managed node group | Verification account and region | Kubernetes workload plane | `deploy/terraform/aws` | Destroyed by Terraform | Used for Helm and conformance verification. |
| deleted | ECR repositories and images | Verification account and region | Workload image registry | `deploy/terraform/aws` plus local image pushes | Destroyed by Terraform | Included temporary API, worker, and web verification images. |
| deleted | S3 bucket | Verification account and region | Native AWS object storage verification | `deploy/terraform/aws` | Destroyed by Terraform | Public access block, versioning, encryption, and force-destroy cleanup were verified. |
| deleted | Secrets Manager secret | Verification account and region | Runtime secret store reference | `deploy/terraform/aws` | Deleted during shutdown | Placeholder secret metadata only; no secret values were committed. |
| deleted | VPC, subnets, internet gateway, route table | Verification account and region | EKS network substrate | `deploy/terraform/aws` | Destroyed by Terraform | Verification network was cleanup-tagged. |
| deleted | IAM roles, policies, and EKS OIDC provider | Verification account and region | IRSA for OpenGeni runtime and storage-driver access | `deploy/terraform/aws` | Destroyed by Terraform | Verified least-privilege S3 access for the runtime role. |
| deleted | EBS CSI add-on and volume | EKS cluster | Dynamic Postgres PVC provisioning | `deploy/terraform/aws` and Kubernetes PVC | Destroyed by Terraform and namespace cleanup | The smoke Postgres PVC bound through the AWS EBS CSI driver. |
| deleted | Kubernetes namespace, Helm release, runtime secret, and PVCs | EKS cluster | OpenGeni conformance deployment | Helm and kubectl | Deleted before Terraform destroy | Conformance verified API health, metrics, session run, event replay, SSE replay, scheduled task dispatch, and S3 upload/download. |
