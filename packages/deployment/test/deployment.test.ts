import { describe, expect, test } from "bun:test";
import {
  deploymentProfiles,
  missingRuntimeEnvVars,
  parseDeploymentContract,
  preflightChecksFor,
  requiredRuntimeEnvVars,
} from "../src/index";

describe("deployment contract", () => {
  test("ships valid built-in profiles", () => {
    for (const profile of Object.values(deploymentProfiles)) {
      expect(parseDeploymentContract(profile).profile).toBe(profile.profile);
    }
  });

  test("requires Kubernetes namespace for Kubernetes runtime", () => {
    expect(() => parseDeploymentContract({
      ...deploymentProfiles["kubernetes-external"],
      runtime: {
        platform: "kubernetes",
        cloud: "generic",
      },
    })).toThrow("Kubernetes deployments require runtime.namespace");
  });

  test("supports existing Postgres and Temporal as external dependencies", () => {
    const contract = deploymentProfiles["azure-existing-services"];

    expect(contract.database.mode).toBe("external");
    expect(contract.database.external?.secretRef?.name).toBe("opengeni-database");
    expect(contract.temporal.mode).toBe("external");
    expect(contract.temporal.external?.secretRef?.name).toBe("opengeni-temporal");
  });

  test("includes conformance checks for Azure managed profile", () => {
    const checks = preflightChecksFor(deploymentProfiles["azure-managed"]).map((check) => check.id);

    expect(checks).toContain("kubernetes-context");
    expect(checks).toContain("postgres-pgvector");
    expect(checks).toContain("temporal-connectivity");
    expect(checks).toContain("nats-pubsub");
    expect(checks).toContain("conformance-session");
  });

  test("models local Kubernetes as Helm with in-cluster dependencies and port-forward conformance", () => {
    const contract = deploymentProfiles["local-kubernetes"];

    expect(contract.runtime.platform).toBe("kubernetes");
    expect(contract.runtime.cloud).toBe("local");
    expect(contract.runtime.namespace).toBe("opengeni-local");
    expect(contract.database.mode).toBe("inCluster");
    expect(contract.temporal.mode).toBe("inCluster");
    expect(contract.nats.mode).toBe("inCluster");
    expect(contract.objectStorage.mode).toBe("inCluster");
    expect(contract.objectStorage.api).toBe("s3-compatible");
    expect(contract.ingress.enabled).toBe(false);
  });

  test("models Azure managed profile with external Temporal/NATS and Azure Blob storage", () => {
    const contract = deploymentProfiles["azure-managed"];

    expect(contract.temporal.mode).toBe("external");
    expect(contract.temporal.external?.secretRef?.key).toBe("OPENGENI_TEMPORAL_HOST");
    expect(contract.nats.mode).toBe("external");
    expect(contract.nats.external?.secretRef?.key).toBe("OPENGENI_NATS_URL");
    expect(contract.objectStorage.mode).toBe("managed");
    expect(contract.objectStorage.api).toBe("azure-blob");
    expect(contract.sandbox.backend).toBe("none");
  });

  test("models AWS and GCP managed profiles with native object storage", () => {
    const aws = deploymentProfiles["aws-managed"];
    const gcp = deploymentProfiles["gcp-managed"];

    expect(aws.runtime.cloud).toBe("aws");
    expect(aws.temporal.mode).toBe("external");
    expect(aws.nats.mode).toBe("external");
    expect(aws.objectStorage.mode).toBe("managed");
    expect(aws.objectStorage.api).toBe("aws-s3");
    expect(aws.secrets.mode).toBe("awsSecretsManager");
    expect(aws.observability.backend).toBe("awsManaged");

    expect(gcp.runtime.cloud).toBe("gcp");
    expect(gcp.temporal.mode).toBe("external");
    expect(gcp.nats.mode).toBe("external");
    expect(gcp.objectStorage.mode).toBe("managed");
    expect(gcp.objectStorage.api).toBe("gcs");
    expect(gcp.secrets.mode).toBe("gcpSecretManager");
    expect(gcp.observability.backend).toBe("gcpManaged");
  });

  test("models PR and branch previews as isolated Kubernetes environments", () => {
    const pr = deploymentProfiles["preview-pr"];
    const branch = deploymentProfiles["preview-branch"];

    expect(pr.runtime.platform).toBe("kubernetes");
    expect(pr.runtime.namespace).toBe("opengeni-preview-pr");
    expect(pr.database.mode).toBe("inCluster");
    expect(pr.objectStorage.api).toBe("s3-compatible");
    expect(pr.secrets.mode).toBe("externalSecrets");

    expect(branch.runtime.platform).toBe("kubernetes");
    expect(branch.runtime.namespace).toBe("opengeni-preview-branch");
  });

  test("allows Modal with Azure Blob because runtime materializes file resources into the sandbox", () => {
    const contract = parseDeploymentContract({
      ...deploymentProfiles["azure-managed"],
      sandbox: { backend: "modal", preparationProfiles: ["none"], envAllowlist: [] },
    });

    expect(contract.sandbox.backend).toBe("modal");
    expect(contract.objectStorage.api).toBe("azure-blob");
  });

  test("lists runtime environment variables needed by deployment renderers", () => {
    const vars = requiredRuntimeEnvVars(deploymentProfiles["azure-existing-services"]);

    expect(vars).toContain("OPENGENI_DATABASE_URL");
    expect(vars).toContain("OPENGENI_TEMPORAL_HOST");
    expect(vars).toContain("OPENGENI_NATS_URL");
    expect(vars).toContain("OPENGENI_OBJECT_STORAGE_BACKEND");
    expect(vars).toContain("OPENGENI_OBJECT_STORAGE_AZURE_CONNECTION_STRING");
  });

  test("lists native cloud storage environment variables without static key assumptions", () => {
    const awsVars = requiredRuntimeEnvVars(deploymentProfiles["aws-existing-services"]);
    const gcpVars = requiredRuntimeEnvVars(deploymentProfiles["gcp-existing-services"]);

    expect(awsVars).toContain("OPENGENI_OBJECT_STORAGE_REGION");
    expect(awsVars).not.toContain("OPENGENI_OBJECT_STORAGE_ACCESS_KEY_ID");
    expect(awsVars).not.toContain("OPENGENI_OBJECT_STORAGE_ENDPOINT");

    expect(gcpVars).toContain("OPENGENI_OBJECT_STORAGE_GCS_PROJECT_ID");
    expect(gcpVars).not.toContain("OPENGENI_OBJECT_STORAGE_ACCESS_KEY_ID");
    expect(gcpVars).not.toContain("OPENGENI_OBJECT_STORAGE_ENDPOINT");
  });

  test("does not require generated in-cluster dependency values from local env", () => {
    const vars = requiredRuntimeEnvVars(deploymentProfiles["self-contained-kubernetes"]);

    expect(vars).not.toContain("OPENGENI_DATABASE_URL");
    expect(vars).not.toContain("OPENGENI_TEMPORAL_HOST");
    expect(vars).not.toContain("OPENGENI_NATS_URL");
    expect(vars).not.toContain("OPENGENI_OBJECT_STORAGE_ENDPOINT");
  });

  test("detects missing runtime environment variables without exposing values", () => {
    const missing = missingRuntimeEnvVars(deploymentProfiles["azure-existing-services"], {
      OPENGENI_DATABASE_URL: "postgres://secret",
      OPENGENI_TEMPORAL_HOST: "temporal:7233",
      OPENGENI_OBJECT_STORAGE_BACKEND: "azure-blob",
    });

    expect(missing).not.toContain("OPENGENI_DATABASE_URL");
    expect(missing).not.toContain("OPENGENI_TEMPORAL_HOST");
    expect(missing).toContain("OPENGENI_OBJECT_STORAGE_AZURE_CONNECTION_STRING");
  });
});
