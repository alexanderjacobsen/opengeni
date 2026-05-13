# AWS Resource Ledger

Track every AWS resource created while developing and verifying the OpenGeni AWS reference deployment. Do not create AWS resources without adding or updating an entry here.

## Rules

- Never include secrets, access keys, kubeconfigs, connection strings with passwords, private key material, or generated service credentials.
- Prefer cleanup-friendly names and tags.
- Tag resources with at least `project=opengeni`, `owner=codex`, and `purpose=deployment-verification` when supported.
- Record the creation command or Terraform module responsible for the resource.
- Record the cleanup command before considering the resource safe to leave temporarily.
- If a command fails because of permissions, quota, billing, region availability, or organization policy, record the blocker here instead of retrying blindly.

## Resources

| Status | Resource Type | Name | Account/Region | Purpose | Created By | Cleanup Command | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| blocked | AWS reference substrate | `opengeni-codex-8092-*` | `066730217701/us-east-1` | EKS/ECR/S3/Secrets/observability verification | `deploy/terraform/aws` | No created resources to delete; if partially created later, run `terraform -chdir=deploy/terraform/aws destroy -var-file=terraform.tfvars`. | `terraform plan` succeeds with `/Users/jorgensandhaug/Documents/cloudgeni-ai/cloudgeni/.env` loaded, but `terraform apply` is blocked by IAM. The `jorge-local-dev` user lacks create permissions for EC2 VPC, IAM roles, ECR repositories, S3 buckets, and Secrets Manager secrets. Terraform state contains data sources only, not created resources. |
| blocked | EKS cluster | `opengeni-codex-8092-eks` | `066730217701/us-east-1` | Kubernetes workload plane | `deploy/terraform/aws` | No created resource to delete. | Blocked before creation by missing EC2/IAM permissions. |
| blocked | ECR repositories | `opengeni-api`, `opengeni-worker`, `opengeni-web` | `066730217701/us-east-1` | Workload image registry | `deploy/terraform/aws` | No created repositories to delete. | Blocked before creation by missing `ecr:CreateRepository`. |
| blocked | S3 bucket | `opengenicodex8092-files-*` | `066730217701/us-east-1` | Native AWS S3 file storage | `deploy/terraform/aws` | No created bucket to delete. | Blocked before creation by missing `s3:CreateBucket`. |
| blocked | Secrets Manager secret | `opengeni-codex-8092/runtime` | `066730217701/us-east-1` | Runtime secret storage | `deploy/terraform/aws` | No created secret to delete. | Blocked before creation by missing `secretsmanager:CreateSecret`. |
