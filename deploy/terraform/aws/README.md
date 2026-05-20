# AWS Reference Substrate

This root creates a cleanup-friendly AWS substrate for the Helm chart:

- EKS cluster and managed node group.
- ECR repositories scoped under `name_prefix` for API, worker, and web images.
- S3 bucket for `OPENGENI_OBJECT_STORAGE_BACKEND=aws-s3`.
- AWS Secrets Manager runtime secret placeholder.
- Optional RDS PostgreSQL when `postgres.mode = "managed"`.
- `temporal.mode = "officialChart"` output wiring for the stack-wrapper managed upstream Temporal chart, or `external` for Temporal Cloud/customer endpoints.

Keep OpenGeni workloads in the provider-neutral Helm chart. This root should only create cloud substrate and emit non-secret Helm values.

## Validate

```bash
terraform -chdir=deploy/terraform/aws init -backend=false
terraform -chdir=deploy/terraform/aws fmt -check
terraform -chdir=deploy/terraform/aws validate
```

## Apply

Before creating resources, add planned names, region, and cleanup commands to `docs/aws-resource-ledger.md`.

```bash
terraform -chdir=deploy/terraform/aws plan -var-file=terraform.tfvars
terraform -chdir=deploy/terraform/aws apply -var-file=terraform.tfvars
```

For temporary verification stacks, set `postgres.deletion_protection = false`
and `postgres.skip_final_snapshot = true` before apply, and record that cleanup
choice in `docs/aws-resource-ledger.md`. For production-like stacks, keep final
snapshots and deletion protection enabled.

Do not commit state, kubeconfigs, generated database passwords, AWS credentials, or filled secret values.
The official Temporal chart still needs durable Postgres databases prepared outside the OpenGeni app chart before Helm install.
