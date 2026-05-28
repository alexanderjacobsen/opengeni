import { describe, expect, test } from "bun:test";
import {
  deploymentProfiles,
  generateRuntimeArtifacts,
  missingRuntimeEnvVars,
  parseDeploymentContract,
  preflightChecksFor,
  requiredRuntimeEnvVars,
  stackPlanFor,
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
    const plan = stackPlanFor(contract);

    expect(contract.runtime.platform).toBe("kubernetes");
    expect(contract.runtime.cloud).toBe("local");
    expect(contract.runtime.namespace).toBe("opengeni-local");
    expect(contract.database.mode).toBe("inCluster");
    expect(contract.temporal.mode).toBe("inCluster");
    expect(contract.nats.mode).toBe("inCluster");
    expect(contract.objectStorage.mode).toBe("inCluster");
    expect(contract.objectStorage.api).toBe("s3-compatible");
    expect(contract.ingress.enabled).toBe(false);
    expect(plan.helmValuesFile).toBe("deploy/helm/opengeni/values.local-kubernetes.example.yaml");
    expect(plan.deployCommands.some((command) => command.includes("kind load docker-image"))).toBe(true);
    expect(plan.deployCommands.some((command) => command.includes("opengeni-runtime-local-k8s"))).toBe(true);
  });

  test("models Azure managed profile with external Temporal/NATS and Azure Blob storage", () => {
    const contract = deploymentProfiles["azure-managed"];

    expect(contract.temporal.mode).toBe("external");
    expect(contract.temporal.external?.secretRef?.key).toBe("OPENGENI_TEMPORAL_HOST");
    expect(contract.nats.mode).toBe("external");
    expect(contract.nats.external?.secretRef?.key).toBe("OPENGENI_NATS_URL");
    expect(contract.objectStorage.mode).toBe("managed");
    expect(contract.objectStorage.api).toBe("azure-blob");
    expect(contract.access.mode).toBe("sharedKey");
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
    expect(aws.access.mode).toBe("sharedKey");
    expect(aws.observability.backend).toBe("awsManaged");

    expect(gcp.runtime.cloud).toBe("gcp");
    expect(gcp.temporal.mode).toBe("external");
    expect(gcp.nats.mode).toBe("external");
    expect(gcp.objectStorage.mode).toBe("managed");
    expect(gcp.objectStorage.api).toBe("gcs");
    expect(gcp.secrets.mode).toBe("gcpSecretManager");
    expect(gcp.access.mode).toBe("sharedKey");
    expect(gcp.observability.backend).toBe("gcpManaged");
  });

  test("requires an access boundary for ingress-enabled deployments", () => {
    expect(() => parseDeploymentContract({
      ...deploymentProfiles["kubernetes-external"],
      access: { mode: "disabled" },
    })).toThrow("ingress-enabled deployments require shared-key auth or an external gateway");
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
    expect(vars).toContain("OPENGENI_AUTH_REQUIRED");
    expect(vars).toContain("OPENGENI_ACCESS_KEY");
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

  test("renders stack plans with deploy, verify, and destroy commands", () => {
    const plan = stackPlanFor(deploymentProfiles["gcp-managed"]);

    expect(plan.terraformRoot).toBe("deploy/terraform/gcp");
    expect(plan.helmValuesFile).toBe("deploy/helm/opengeni/values.gcp-managed.example.yaml");
    expect(plan.platformDependencies.map((dependency) => dependency.id)).toEqual(["nats", "temporal"]);
    expect(plan.platformDependencies[0]?.chartName).toBe("nats/nats");
    expect(plan.platformDependencies[1]?.chartName).toBe("temporal/temporal");
    expect(plan.platformDependencies[0]?.runtimeEnv.OPENGENI_NATS_URL).toContain("opengeni-nats.opengeni-platform");
    expect(plan.platformDependencies[1]?.runtimeEnv.OPENGENI_TEMPORAL_HOST).toContain("opengeni-temporal-frontend.opengeni-platform");
    expect(plan.platformDependencies[1]?.requiredEnvVars).toContain("TEMPORAL_POSTGRES_HOST");
    expect(plan.platformDependencies[1]?.requiredEnvVars).toContain("TEMPORAL_POSTGRES_PASSWORD");
    expect(plan.creates).toContain("GKE cluster");
    expect(plan.requiredSecretKeys).toContain("OPENGENI_ACCESS_KEY");
    expect(plan.requiredSecretKeys).toContain("opengeni-temporal-postgres/password");
    expect(plan.deployCommands.some((command) => command.includes("helm repo add nats"))).toBe(true);
    expect(plan.deployCommands.some((command) => command.includes("helm repo add temporal"))).toBe(true);
    expect(plan.deployCommands.some((command) => command.includes("terraform -chdir=deploy/terraform/gcp apply"))).toBe(true);
    expect(plan.deployCommands.some((command) => command.includes("docker build") && command.includes("--target api"))).toBe(true);
    expect(plan.deployCommands.some((command) => command.includes("docker push"))).toBe(true);
    expect(plan.deployCommands.some((command) => command.includes("deployment:runtime-artifacts"))).toBe(true);
    expect(plan.deployCommands.some((command) => command.includes("opengeni-runtime"))).toBe(true);
    expect(plan.deployCommands.some((command) => command.includes(".agent/generated/gcp-managed/helm-values.generated.yaml"))).toBe(true);
    expect(plan.verifyCommands.some((command) => command.includes("rollout status statefulset/opengeni-nats"))).toBe(true);
    expect(plan.verifyCommands.some((command) => command.includes("helm test opengeni-nats"))).toBe(true);
    expect(plan.verifyCommands.some((command) => command.includes("rollout status deployment/opengeni-temporal-frontend"))).toBe(true);
    expect(plan.verifyCommands.some((command) => command.includes("helm test opengeni-temporal"))).toBe(true);
    expect(plan.verifyCommands.some((command) => command.includes("OPENGENI_CONFORMANCE_ACCESS_KEY"))).toBe(true);
    expect(plan.destroyCommands.some((command) => command.includes("helm uninstall opengeni-temporal"))).toBe(true);
    expect(plan.destroyCommands.some((command) => command.includes("helm uninstall opengeni-nats"))).toBe(true);
    expect(plan.destroyCommands.at(-1)).toContain("terraform -chdir=deploy/terraform/gcp destroy");
  });

  test("renders AWS Temporal TLS commands with concrete generated paths", () => {
    const plan = stackPlanFor(deploymentProfiles["aws-managed"]);
    const commands = plan.deployCommands.join("\n");

    expect(commands).toContain(".agent/generated/aws-managed/rds-global-bundle.pem");
    expect(commands).not.toContain("${contract.profile}");
  });

  test("does not plan cloud substrate for existing-service profiles", () => {
    const plan = stackPlanFor(deploymentProfiles["aws-existing-services"]);

    expect(plan.terraformRoot).toBeNull();
    expect(plan.platformDependencies).toEqual([]);
    expect(plan.externalDependencies).toContain("Postgres with pgvector reachable through OPENGENI_DATABASE_URL");
    expect(plan.destroyCommands.some((command) => command.includes("terraform"))).toBe(false);
  });

  test("generates private runtime artifacts from GCP Terraform outputs without hand-editing Helm paths", () => {
    const artifacts = generateRuntimeArtifacts(deploymentProfiles["gcp-managed"], {
      project_id: { value: "opengeni-example" },
      region: { value: "us-central1" },
      temporal_host: { value: "opengeni-temporal-frontend.opengeni-platform.svc.cluster.local:7233" },
      temporal_namespace: { value: "default" },
      temporal_task_queue: { value: "opengeni-runs-ts" },
      object_storage_bucket: { value: "opengeni-example-files" },
      helm_set_values: {
        value: {
          "global.imageRegistry": "us-central1-docker.pkg.dev/opengeni-example/opengeni",
          "serviceAccount.annotations.iam\\.gke\\.io/gcp-service-account": "opengeni-runtime@opengeni-example.iam.gserviceaccount.com",
          "config.OPENGENI_OBJECT_STORAGE_BUCKET": "opengeni-example-files",
        },
      },
    }, {
      OPENGENI_ACCESS_KEY: "test-access-key",
      OPENGENI_DATABASE_URL: "postgres://opengeni:secret@postgres/opengeni",
      OPENGENI_IMAGE_TAG: "test-sha",
    });

    expect(artifacts.missingEnvVars).toEqual([]);
    expect(artifacts.helmValuesYaml).toContain("imageRegistry: \"us-central1-docker.pkg.dev/opengeni-example/opengeni\"");
    expect(artifacts.helmValuesYaml).toContain("tag: \"test-sha\"");
    expect(artifacts.helmValuesYaml).toContain("digest: \"\"");
    expect(artifacts.helmValuesYaml).toContain("iam.gke.io/gcp-service-account: \"opengeni-runtime@opengeni-example.iam.gserviceaccount.com\"");
    expect(artifacts.runtimeEnv).toContain("OPENGENI_OBJECT_STORAGE_BACKEND=gcs");
    expect(artifacts.runtimeEnv).toContain("OPENGENI_OBJECT_STORAGE_GCS_PROJECT_ID=opengeni-example");
    expect(artifacts.runtimeEnv).toContain("OPENGENI_NATS_URL=nats://opengeni-nats.opengeni-platform.svc.cluster.local:4222");
    expect(artifacts.summary.secretNames).toContain("opengeni-runtime");
  });

  test("uses sensitive Azure Terraform connection string only in private runtime env", () => {
    const artifacts = generateRuntimeArtifacts(deploymentProfiles["azure-managed"], {
      temporal_host: { value: "opengeni-temporal-frontend.opengeni-platform.svc.cluster.local:7233" },
      temporal_namespace: { value: "default" },
      temporal_task_queue: { value: "opengeni-runs-ts" },
      object_storage_bucket: { value: "opengeni-files" },
      object_storage_azure_connection_string: { value: "DefaultEndpointsProtocol=https;AccountName=files;AccountKey=secret", sensitive: true },
      helm_set_values: {
        value: {
          "global.imageRegistry": "opengeni.azurecr.io",
          "config.OPENGENI_OBJECT_STORAGE_BACKEND": "azure-blob",
        },
      },
    }, {
      OPENGENI_ACCESS_KEY: "test-access-key",
      OPENGENI_DATABASE_URL: "postgres://opengeni:secret@postgres/opengeni",
    });

    expect(artifacts.missingEnvVars).toEqual([]);
    expect(artifacts.sensitiveTerraformOutputsUsed).toEqual(["object_storage_azure_connection_string"]);
    expect(artifacts.runtimeEnv).toContain("OPENGENI_OBJECT_STORAGE_AZURE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=files;AccountKey=secret");
    expect(artifacts.helmValuesYaml).not.toContain("AccountKey=secret");
  });

  test("reports missing required runtime secrets without fabricating values", () => {
    const artifacts = generateRuntimeArtifacts(deploymentProfiles["aws-managed"], {
      region: { value: "us-east-1" },
      temporal_host: { value: "opengeni-temporal-frontend.opengeni-platform.svc.cluster.local:7233" },
      object_storage_bucket: { value: "opengeni-files" },
      helm_set_values: { value: {} },
    }, {});

    expect(artifacts.missingEnvVars).toContain("OPENGENI_ACCESS_KEY");
    expect(artifacts.missingEnvVars).toContain("OPENGENI_DATABASE_URL");
    expect(artifacts.runtimeEnv).toContain("OPENGENI_ACCESS_KEY=");
    expect(artifacts.runtimeEnv).toContain("OPENGENI_DATABASE_URL=");
  });
});
