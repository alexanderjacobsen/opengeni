import { z } from "zod";

export const DeploymentProfileId = z.enum([
  "local-compose",
  "local-kubernetes",
  "kubernetes-external",
  "azure-managed",
  "azure-existing-services",
  "aws-managed",
  "aws-existing-services",
  "gcp-managed",
  "gcp-existing-services",
  "preview-pr",
  "preview-branch",
  "self-contained-kubernetes",
]);
export type DeploymentProfileId = z.infer<typeof DeploymentProfileId>;

export const CloudProvider = z.enum(["local", "generic", "azure", "aws", "gcp"]);
export type CloudProvider = z.infer<typeof CloudProvider>;

export const RuntimePlatform = z.enum(["docker-compose", "kubernetes"]);
export type RuntimePlatform = z.infer<typeof RuntimePlatform>;

export const DependencyMode = z.enum(["managed", "external", "inCluster", "disabled"]);
export type DependencyMode = z.infer<typeof DependencyMode>;

export const StorageApi = z.enum(["s3-compatible", "aws-s3", "azure-blob", "gcs"]);
export type StorageApi = z.infer<typeof StorageApi>;

export const SandboxBackend = z.enum(["docker", "modal", "local", "none"]);
export type SandboxBackend = z.infer<typeof SandboxBackend>;

export const SecretDeliveryMode = z.enum([
  "envFile",
  "kubernetesSecret",
  "externalSecrets",
  "vault",
  "azureKeyVault",
  "awsSecretsManager",
  "gcpSecretManager",
]);
export type SecretDeliveryMode = z.infer<typeof SecretDeliveryMode>;

export const ObservabilityBackend = z.enum([
  "none",
  "otel",
  "grafanaLgtm",
  "azureMonitor",
  "awsManaged",
  "gcpManaged",
  "prometheusGrafana",
  "datadog",
  "honeycomb",
  "customerProvided",
]);
export type ObservabilityBackend = z.infer<typeof ObservabilityBackend>;

export const AccessMode = z.enum(["disabled", "sharedKey", "externalGateway"]);
export type AccessMode = z.infer<typeof AccessMode>;

export const SecretRef = z.object({
  name: z.string().min(1),
  key: z.string().min(1).optional(),
});
export type SecretRef = z.infer<typeof SecretRef>;

export const ExternalServiceRef = z.object({
  endpoint: z.string().min(1).optional(),
  secretRef: SecretRef.optional(),
  tlsSecretRef: SecretRef.optional(),
  notes: z.string().min(1).optional(),
});
export type ExternalServiceRef = z.infer<typeof ExternalServiceRef>;

export const ManagedServiceRef = z.object({
  provider: CloudProvider.exclude(["local"]),
  resourceGroup: z.string().min(1).optional(),
  resourceName: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
});
export type ManagedServiceRef = z.infer<typeof ManagedServiceRef>;

export const RuntimeSpec = z.object({
  platform: RuntimePlatform,
  cloud: CloudProvider,
  namespace: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  imageRegistry: z.string().min(1).optional(),
  releaseName: z.string().min(1).default("opengeni"),
});
export type RuntimeSpec = z.infer<typeof RuntimeSpec>;

export const DatabaseSpec = z.object({
  mode: DependencyMode.exclude(["disabled"]),
  engine: z.literal("postgres"),
  pgvectorRequired: z.boolean().default(true),
  external: ExternalServiceRef.optional(),
  managed: ManagedServiceRef.optional(),
});
export type DatabaseSpec = z.infer<typeof DatabaseSpec>;

export const TemporalSpec = z.object({
  mode: DependencyMode.exclude(["disabled"]),
  namespace: z.string().min(1).default("default"),
  taskQueue: z.string().min(1).default("opengeni-runs-ts"),
  external: ExternalServiceRef.optional(),
  managed: ManagedServiceRef.optional(),
});
export type TemporalSpec = z.infer<typeof TemporalSpec>;

export const NatsSpec = z.object({
  mode: DependencyMode.exclude(["managed", "disabled"]),
  external: ExternalServiceRef.optional(),
});
export type NatsSpec = z.infer<typeof NatsSpec>;

export const ObjectStorageSpec = z.object({
  mode: DependencyMode.exclude(["disabled"]),
  api: StorageApi,
  bucket: z.string().min(1),
  external: ExternalServiceRef.optional(),
  managed: ManagedServiceRef.optional(),
});
export type ObjectStorageSpec = z.infer<typeof ObjectStorageSpec>;

export const SecretsSpec = z.object({
  mode: SecretDeliveryMode,
  external: ExternalServiceRef.optional(),
});
export type SecretsSpec = z.infer<typeof SecretsSpec>;

export const IngressSpec = z.object({
  enabled: z.boolean().default(true),
  tls: z.boolean().default(true),
  sseTimeoutSeconds: z.number().int().positive().default(3600),
  external: ExternalServiceRef.optional(),
});
export type IngressSpec = z.infer<typeof IngressSpec>;

export const ObservabilitySpec = z.object({
  backend: ObservabilityBackend,
  requireTraces: z.boolean().default(true),
  requireMetrics: z.boolean().default(true),
  requireStructuredLogs: z.boolean().default(true),
  external: ExternalServiceRef.optional(),
});
export type ObservabilitySpec = z.infer<typeof ObservabilitySpec>;

export const AccessSpec = z.object({
  mode: AccessMode,
  allowUnauthenticatedHealth: z.boolean().default(true),
  allowUnauthenticatedMetrics: z.boolean().default(false),
  external: ExternalServiceRef.optional(),
});
export type AccessSpec = z.infer<typeof AccessSpec>;

export const SandboxSpec = z.object({
  backend: SandboxBackend,
  preparationProfiles: z.array(z.enum(["none", "azure", "github"])).default(["none"]),
  envAllowlist: z.array(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/)).default([]),
});
export type SandboxSpec = z.infer<typeof SandboxSpec>;

export const BackupSpec = z.object({
  postgresRequired: z.boolean().default(true),
  objectStorageRequired: z.boolean().default(true),
  restoreDrillRequired: z.boolean().default(true),
});
export type BackupSpec = z.infer<typeof BackupSpec>;

export const DeploymentContract = z.object({
  profile: DeploymentProfileId,
  runtime: RuntimeSpec,
  database: DatabaseSpec,
  temporal: TemporalSpec,
  nats: NatsSpec,
  objectStorage: ObjectStorageSpec,
  secrets: SecretsSpec,
  ingress: IngressSpec,
  access: AccessSpec,
  observability: ObservabilitySpec,
  sandbox: SandboxSpec,
  backups: BackupSpec.default({
    postgresRequired: true,
    objectStorageRequired: true,
    restoreDrillRequired: true,
  }),
}).superRefine((contract, ctx) => {
  if (contract.runtime.platform === "kubernetes" && !contract.runtime.namespace) {
    ctx.addIssue({
      code: "custom",
      path: ["runtime", "namespace"],
      message: "Kubernetes deployments require runtime.namespace",
    });
  }
  if (contract.runtime.platform === "docker-compose" && contract.runtime.cloud !== "local") {
    ctx.addIssue({
      code: "custom",
      path: ["runtime", "cloud"],
      message: "docker-compose deployments must use the local cloud target",
    });
  }
  if (contract.profile.startsWith("azure") && contract.runtime.cloud !== "azure") {
    ctx.addIssue({
      code: "custom",
      path: ["runtime", "cloud"],
      message: "Azure profiles require runtime.cloud=azure",
    });
  }
  if (contract.profile.startsWith("aws") && contract.runtime.cloud !== "aws") {
    ctx.addIssue({
      code: "custom",
      path: ["runtime", "cloud"],
      message: "AWS profiles require runtime.cloud=aws",
    });
  }
  if (contract.profile.startsWith("gcp") && contract.runtime.cloud !== "gcp") {
    ctx.addIssue({
      code: "custom",
      path: ["runtime", "cloud"],
      message: "GCP profiles require runtime.cloud=gcp",
    });
  }
  if (contract.profile.startsWith("preview") && contract.runtime.platform !== "kubernetes") {
    ctx.addIssue({
      code: "custom",
      path: ["runtime", "platform"],
      message: "Preview profiles require Kubernetes runtime",
    });
  }
  if (contract.ingress.enabled && contract.access.mode === "disabled") {
    ctx.addIssue({
      code: "custom",
      path: ["access", "mode"],
      message: "ingress-enabled deployments require shared-key auth or an external gateway",
    });
  }
  requireModeReference(ctx, ["database"], contract.database.mode, contract.database.external, contract.database.managed);
  requireModeReference(ctx, ["temporal"], contract.temporal.mode, contract.temporal.external, contract.temporal.managed);
  requireModeReference(ctx, ["objectStorage"], contract.objectStorage.mode, contract.objectStorage.external, contract.objectStorage.managed);
  if (contract.nats.mode === "external" && !contract.nats.external) {
    ctx.addIssue({
      code: "custom",
      path: ["nats", "external"],
      message: "external NATS requires an external service reference",
    });
  }
  if (contract.objectStorage.api === "azure-blob" && contract.objectStorage.mode !== "managed" && contract.runtime.cloud !== "azure") {
    ctx.addIssue({
      code: "custom",
      path: ["objectStorage", "api"],
      message: "azure-blob storage is only valid for Azure managed/reference deployments",
    });
  }
  if (contract.objectStorage.api === "aws-s3" && !["aws", "generic"].includes(contract.runtime.cloud)) {
    ctx.addIssue({
      code: "custom",
      path: ["objectStorage", "api"],
      message: "aws-s3 storage is only valid for AWS or generic Kubernetes deployments",
    });
  }
  if (contract.objectStorage.api === "gcs" && !["gcp", "generic"].includes(contract.runtime.cloud)) {
    ctx.addIssue({
      code: "custom",
      path: ["objectStorage", "api"],
      message: "gcs storage is only valid for GCP or generic Kubernetes deployments",
    });
  }
});
export type DeploymentContract = z.infer<typeof DeploymentContract>;

export type PreflightCheckId =
  | "kubernetes-context"
  | "container-registry"
  | "postgres-connectivity"
  | "postgres-pgvector"
  | "postgres-migrations"
  | "temporal-connectivity"
  | "temporal-worker-task-queue"
  | "nats-pubsub"
  | "object-storage-read-write"
  | "secret-delivery"
  | "access-boundary"
  | "ingress-sse"
  | "otel-export"
  | "sandbox-readiness"
  | "backup-policy"
  | "conformance-session";

export interface PreflightCheck {
  id: PreflightCheckId;
  required: boolean;
  description: string;
}

export interface DeploymentStackPlan {
  profile: DeploymentProfileId;
  terraformRoot: string | null;
  helmValuesFile: string | null;
  platformDependencies: PlatformDependencyPlan[];
  creates: string[];
  externalDependencies: string[];
  requiredSecretKeys: string[];
  deployCommands: string[];
  verifyCommands: string[];
  destroyCommands: string[];
  notes: string[];
}

export interface PlatformDependencyPlan {
  id: "nats" | "temporal";
  lifecycle: "officialChart" | "external";
  namespace: string;
  releaseName: string;
  chartRepoName: string | null;
  chartRepoUrl: string | null;
  chartName: string | null;
  valuesFile: string | null;
  runtimeEnv: Record<string, string>;
  requiredEnvVars: string[];
  requiredSecretKeys: string[];
  installCommands: string[];
  verifyCommands: string[];
  destroyCommands: string[];
  notes: string[];
}

export interface TerraformOutputValue {
  sensitive?: boolean;
  type?: unknown;
  value: unknown;
}

export type TerraformOutputs = Record<string, TerraformOutputValue>;

export interface DeploymentRuntimeArtifacts {
  profile: DeploymentProfileId;
  helmValuesYaml: string;
  runtimeEnv: string;
  requiredEnvVars: string[];
  missingEnvVars: string[];
  sensitiveTerraformOutputsUsed: string[];
  summary: {
    helmValueKeys: string[];
    runtimeEnvKeys: string[];
    secretNames: string[];
  };
}

export const deploymentProfiles: Record<DeploymentProfileId, DeploymentContract> = {
  "local-compose": parseDeploymentContract({
    profile: "local-compose",
    runtime: { platform: "docker-compose", cloud: "local", releaseName: "opengeni" },
    database: { mode: "inCluster", engine: "postgres", pgvectorRequired: true },
    temporal: { mode: "inCluster", namespace: "default", taskQueue: "opengeni-runs-ts" },
    nats: { mode: "inCluster" },
    objectStorage: { mode: "inCluster", api: "s3-compatible", bucket: "opengeni-files" },
    secrets: { mode: "envFile" },
    ingress: { enabled: false, tls: false, sseTimeoutSeconds: 3600 },
    access: { mode: "disabled", allowUnauthenticatedHealth: true, allowUnauthenticatedMetrics: true },
    observability: { backend: "none", requireTraces: false, requireMetrics: false, requireStructuredLogs: true },
    sandbox: { backend: "docker", preparationProfiles: ["none"], envAllowlist: [] },
  }),
  "local-kubernetes": parseDeploymentContract({
    profile: "local-kubernetes",
    runtime: { platform: "kubernetes", cloud: "local", namespace: "opengeni-local", releaseName: "opengeni-local" },
    database: { mode: "inCluster", engine: "postgres", pgvectorRequired: true },
    temporal: { mode: "inCluster", namespace: "default", taskQueue: "opengeni-runs-ts" },
    nats: { mode: "inCluster" },
    objectStorage: { mode: "inCluster", api: "s3-compatible", bucket: "opengeni-files" },
    secrets: { mode: "kubernetesSecret" },
    ingress: { enabled: false, tls: false, sseTimeoutSeconds: 3600 },
    access: { mode: "sharedKey", allowUnauthenticatedHealth: true, allowUnauthenticatedMetrics: false },
    observability: { backend: "none", requireTraces: false, requireMetrics: false, requireStructuredLogs: true },
    sandbox: { backend: "none", preparationProfiles: ["none"], envAllowlist: [] },
  }),
  "kubernetes-external": parseDeploymentContract({
    profile: "kubernetes-external",
    runtime: { platform: "kubernetes", cloud: "generic", namespace: "opengeni", releaseName: "opengeni" },
    database: {
      mode: "external",
      engine: "postgres",
      pgvectorRequired: true,
      external: { secretRef: { name: "opengeni-database", key: "OPENGENI_DATABASE_URL" } },
    },
    temporal: {
      mode: "external",
      namespace: "default",
      taskQueue: "opengeni-runs-ts",
      external: { secretRef: { name: "opengeni-temporal" } },
    },
    nats: { mode: "external", external: { secretRef: { name: "opengeni-nats", key: "OPENGENI_NATS_URL" } } },
    objectStorage: {
      mode: "external",
      api: "s3-compatible",
      bucket: "opengeni-files",
      external: { secretRef: { name: "opengeni-object-storage" } },
    },
    secrets: { mode: "externalSecrets" },
    ingress: { enabled: true, tls: true, sseTimeoutSeconds: 3600 },
    access: { mode: "sharedKey", allowUnauthenticatedHealth: true, allowUnauthenticatedMetrics: false },
    observability: { backend: "otel", requireTraces: true, requireMetrics: true, requireStructuredLogs: true },
    sandbox: { backend: "none", preparationProfiles: ["none"], envAllowlist: [] },
  }),
  "azure-managed": parseDeploymentContract({
    profile: "azure-managed",
    runtime: { platform: "kubernetes", cloud: "azure", namespace: "opengeni", releaseName: "opengeni" },
    database: {
      mode: "managed",
      engine: "postgres",
      pgvectorRequired: true,
      managed: { provider: "azure", notes: "Azure Database for PostgreSQL Flexible Server with pgvector enabled." },
    },
    temporal: {
      mode: "external",
      namespace: "default",
      taskQueue: "opengeni-runs-ts",
      external: {
        secretRef: { name: "opengeni-temporal", key: "OPENGENI_TEMPORAL_HOST" },
        notes: "Temporal Cloud, customer-provided Temporal, or the official Temporal chart managed outside the OpenGeni chart.",
      },
    },
    nats: {
      mode: "external",
      external: {
        secretRef: { name: "opengeni-nats", key: "OPENGENI_NATS_URL" },
        notes: "Customer-provided NATS or the official NATS chart managed outside the OpenGeni chart.",
      },
    },
    objectStorage: {
      mode: "managed",
      api: "azure-blob",
      bucket: "opengeni-files",
      managed: { provider: "azure", notes: "Azure Storage account Blob container for production file storage." },
    },
    secrets: { mode: "azureKeyVault" },
    ingress: { enabled: true, tls: true, sseTimeoutSeconds: 3600 },
    access: { mode: "sharedKey", allowUnauthenticatedHealth: true, allowUnauthenticatedMetrics: false },
    observability: { backend: "azureMonitor", requireTraces: true, requireMetrics: true, requireStructuredLogs: true },
    sandbox: { backend: "none", preparationProfiles: ["none"], envAllowlist: [] },
  }),
  "azure-existing-services": parseDeploymentContract({
    profile: "azure-existing-services",
    runtime: { platform: "kubernetes", cloud: "azure", namespace: "opengeni", releaseName: "opengeni" },
    database: {
      mode: "external",
      engine: "postgres",
      pgvectorRequired: true,
      external: { secretRef: { name: "opengeni-database", key: "OPENGENI_DATABASE_URL" } },
    },
    temporal: {
      mode: "external",
      namespace: "default",
      taskQueue: "opengeni-runs-ts",
      external: { secretRef: { name: "opengeni-temporal" } },
    },
    nats: { mode: "external", external: { secretRef: { name: "opengeni-nats", key: "OPENGENI_NATS_URL" } } },
    objectStorage: {
      mode: "external",
      api: "azure-blob",
      bucket: "opengeni-files",
      external: { secretRef: { name: "opengeni-object-storage" } },
    },
    secrets: { mode: "azureKeyVault" },
    ingress: { enabled: true, tls: true, sseTimeoutSeconds: 3600 },
    access: { mode: "sharedKey", allowUnauthenticatedHealth: true, allowUnauthenticatedMetrics: false },
    observability: { backend: "azureMonitor", requireTraces: true, requireMetrics: true, requireStructuredLogs: true },
    sandbox: { backend: "none", preparationProfiles: ["none"], envAllowlist: [] },
  }),
  "aws-managed": parseDeploymentContract({
    profile: "aws-managed",
    runtime: { platform: "kubernetes", cloud: "aws", namespace: "opengeni", releaseName: "opengeni" },
    database: {
      mode: "managed",
      engine: "postgres",
      pgvectorRequired: true,
      managed: { provider: "aws", notes: "Amazon RDS PostgreSQL with pgvector compatibility verified." },
    },
    temporal: {
      mode: "external",
      namespace: "default",
      taskQueue: "opengeni-runs-ts",
      external: {
        secretRef: { name: "opengeni-temporal", key: "OPENGENI_TEMPORAL_HOST" },
        notes: "Temporal Cloud, customer-provided Temporal, or the official Temporal chart managed outside the OpenGeni chart.",
      },
    },
    nats: {
      mode: "external",
      external: {
        secretRef: { name: "opengeni-nats", key: "OPENGENI_NATS_URL" },
        notes: "Customer-provided NATS or the official NATS chart managed outside the OpenGeni chart.",
      },
    },
    objectStorage: {
      mode: "managed",
      api: "aws-s3",
      bucket: "opengeni-files",
      managed: { provider: "aws", notes: "Amazon S3 bucket for production file storage." },
    },
    secrets: { mode: "awsSecretsManager" },
    ingress: { enabled: true, tls: true, sseTimeoutSeconds: 3600 },
    access: { mode: "sharedKey", allowUnauthenticatedHealth: true, allowUnauthenticatedMetrics: false },
    observability: { backend: "awsManaged", requireTraces: true, requireMetrics: true, requireStructuredLogs: true },
    sandbox: { backend: "none", preparationProfiles: ["none"], envAllowlist: [] },
  }),
  "aws-existing-services": parseDeploymentContract({
    profile: "aws-existing-services",
    runtime: { platform: "kubernetes", cloud: "aws", namespace: "opengeni", releaseName: "opengeni" },
    database: {
      mode: "external",
      engine: "postgres",
      pgvectorRequired: true,
      external: { secretRef: { name: "opengeni-database", key: "OPENGENI_DATABASE_URL" } },
    },
    temporal: {
      mode: "external",
      namespace: "default",
      taskQueue: "opengeni-runs-ts",
      external: { secretRef: { name: "opengeni-temporal" } },
    },
    nats: { mode: "external", external: { secretRef: { name: "opengeni-nats", key: "OPENGENI_NATS_URL" } } },
    objectStorage: {
      mode: "external",
      api: "aws-s3",
      bucket: "opengeni-files",
      external: { secretRef: { name: "opengeni-object-storage" } },
    },
    secrets: { mode: "awsSecretsManager" },
    ingress: { enabled: true, tls: true, sseTimeoutSeconds: 3600 },
    access: { mode: "sharedKey", allowUnauthenticatedHealth: true, allowUnauthenticatedMetrics: false },
    observability: { backend: "awsManaged", requireTraces: true, requireMetrics: true, requireStructuredLogs: true },
    sandbox: { backend: "none", preparationProfiles: ["none"], envAllowlist: [] },
  }),
  "gcp-managed": parseDeploymentContract({
    profile: "gcp-managed",
    runtime: { platform: "kubernetes", cloud: "gcp", namespace: "opengeni", releaseName: "opengeni" },
    database: {
      mode: "managed",
      engine: "postgres",
      pgvectorRequired: true,
      managed: { provider: "gcp", notes: "Cloud SQL for PostgreSQL with pgvector compatibility verified." },
    },
    temporal: {
      mode: "external",
      namespace: "default",
      taskQueue: "opengeni-runs-ts",
      external: {
        secretRef: { name: "opengeni-temporal", key: "OPENGENI_TEMPORAL_HOST" },
        notes: "Temporal Cloud, customer-provided Temporal, or the official Temporal chart managed outside the OpenGeni chart.",
      },
    },
    nats: {
      mode: "external",
      external: {
        secretRef: { name: "opengeni-nats", key: "OPENGENI_NATS_URL" },
        notes: "Customer-provided NATS or the official NATS chart managed outside the OpenGeni chart.",
      },
    },
    objectStorage: {
      mode: "managed",
      api: "gcs",
      bucket: "opengeni-files",
      managed: { provider: "gcp", notes: "Google Cloud Storage bucket for production file storage." },
    },
    secrets: { mode: "gcpSecretManager" },
    ingress: { enabled: true, tls: true, sseTimeoutSeconds: 3600 },
    access: { mode: "sharedKey", allowUnauthenticatedHealth: true, allowUnauthenticatedMetrics: false },
    observability: { backend: "gcpManaged", requireTraces: true, requireMetrics: true, requireStructuredLogs: true },
    sandbox: { backend: "none", preparationProfiles: ["none"], envAllowlist: [] },
  }),
  "gcp-existing-services": parseDeploymentContract({
    profile: "gcp-existing-services",
    runtime: { platform: "kubernetes", cloud: "gcp", namespace: "opengeni", releaseName: "opengeni" },
    database: {
      mode: "external",
      engine: "postgres",
      pgvectorRequired: true,
      external: { secretRef: { name: "opengeni-database", key: "OPENGENI_DATABASE_URL" } },
    },
    temporal: {
      mode: "external",
      namespace: "default",
      taskQueue: "opengeni-runs-ts",
      external: { secretRef: { name: "opengeni-temporal" } },
    },
    nats: { mode: "external", external: { secretRef: { name: "opengeni-nats", key: "OPENGENI_NATS_URL" } } },
    objectStorage: {
      mode: "external",
      api: "gcs",
      bucket: "opengeni-files",
      external: { secretRef: { name: "opengeni-object-storage" } },
    },
    secrets: { mode: "gcpSecretManager" },
    ingress: { enabled: true, tls: true, sseTimeoutSeconds: 3600 },
    access: { mode: "sharedKey", allowUnauthenticatedHealth: true, allowUnauthenticatedMetrics: false },
    observability: { backend: "gcpManaged", requireTraces: true, requireMetrics: true, requireStructuredLogs: true },
    sandbox: { backend: "none", preparationProfiles: ["none"], envAllowlist: [] },
  }),
  "preview-pr": parseDeploymentContract({
    profile: "preview-pr",
    runtime: { platform: "kubernetes", cloud: "generic", namespace: "opengeni-preview-pr", releaseName: "opengeni-preview" },
    database: { mode: "inCluster", engine: "postgres", pgvectorRequired: true },
    temporal: { mode: "inCluster", namespace: "default", taskQueue: "opengeni-runs-ts" },
    nats: { mode: "inCluster" },
    objectStorage: { mode: "inCluster", api: "s3-compatible", bucket: "opengeni-files" },
    secrets: { mode: "externalSecrets" },
    ingress: { enabled: true, tls: true, sseTimeoutSeconds: 3600 },
    access: { mode: "sharedKey", allowUnauthenticatedHealth: true, allowUnauthenticatedMetrics: false },
    observability: { backend: "otel", requireTraces: true, requireMetrics: true, requireStructuredLogs: true },
    sandbox: { backend: "none", preparationProfiles: ["none"], envAllowlist: [] },
  }),
  "preview-branch": parseDeploymentContract({
    profile: "preview-branch",
    runtime: { platform: "kubernetes", cloud: "generic", namespace: "opengeni-preview-branch", releaseName: "opengeni-preview" },
    database: { mode: "inCluster", engine: "postgres", pgvectorRequired: true },
    temporal: { mode: "inCluster", namespace: "default", taskQueue: "opengeni-runs-ts" },
    nats: { mode: "inCluster" },
    objectStorage: { mode: "inCluster", api: "s3-compatible", bucket: "opengeni-files" },
    secrets: { mode: "externalSecrets" },
    ingress: { enabled: true, tls: true, sseTimeoutSeconds: 3600 },
    access: { mode: "sharedKey", allowUnauthenticatedHealth: true, allowUnauthenticatedMetrics: false },
    observability: { backend: "otel", requireTraces: true, requireMetrics: true, requireStructuredLogs: true },
    sandbox: { backend: "none", preparationProfiles: ["none"], envAllowlist: [] },
  }),
  "self-contained-kubernetes": parseDeploymentContract({
    profile: "self-contained-kubernetes",
    runtime: { platform: "kubernetes", cloud: "generic", namespace: "opengeni", releaseName: "opengeni" },
    database: { mode: "inCluster", engine: "postgres", pgvectorRequired: true },
    temporal: { mode: "inCluster", namespace: "default", taskQueue: "opengeni-runs-ts" },
    nats: { mode: "inCluster" },
    objectStorage: { mode: "inCluster", api: "s3-compatible", bucket: "opengeni-files" },
    secrets: { mode: "kubernetesSecret" },
    ingress: { enabled: true, tls: true, sseTimeoutSeconds: 3600 },
    access: { mode: "sharedKey", allowUnauthenticatedHealth: true, allowUnauthenticatedMetrics: false },
    observability: { backend: "otel", requireTraces: true, requireMetrics: true, requireStructuredLogs: true },
    sandbox: { backend: "none", preparationProfiles: ["none"], envAllowlist: [] },
  }),
};

export function parseDeploymentContract(input: unknown): DeploymentContract {
  return DeploymentContract.parse(input);
}

export function preflightChecksFor(contract: DeploymentContract): PreflightCheck[] {
  const checks: PreflightCheck[] = [];
  if (contract.runtime.platform === "kubernetes") {
    checks.push(check("kubernetes-context", true, "Verify Kubernetes context, namespace, service accounts, and API access."));
    checks.push(check("container-registry", true, "Verify immutable OpenGeni images can be pulled by the workload plane."));
  }
  checks.push(check("postgres-connectivity", true, "Verify API and migration jobs can connect to Postgres."));
  if (contract.database.pgvectorRequired) {
    checks.push(check("postgres-pgvector", true, "Verify the pgvector extension is installed or can be enabled."));
  }
  checks.push(check("postgres-migrations", true, "Verify migrations can run safely and idempotently."));
  checks.push(check("temporal-connectivity", true, "Verify API and workers can reach the configured Temporal endpoint."));
  checks.push(check("temporal-worker-task-queue", true, "Verify workers can poll the configured namespace and task queue."));
  checks.push(check("nats-pubsub", true, "Verify API and workers can publish and subscribe through NATS."));
  checks.push(check("object-storage-read-write", true, "Verify object storage write, read, and URL or mount behavior."));
  checks.push(check("secret-delivery", true, "Verify required runtime secrets are delivered without leaking unintended values."));
  checks.push(check("access-boundary", contract.access.mode !== "disabled", "Verify user-facing API, MCP, files, sessions, schedules, and SSE are behind the configured access boundary."));
  if (contract.ingress.enabled) {
    checks.push(check("ingress-sse", true, "Verify ingress supports long-lived SSE streams and reconnect replay."));
  }
  if (contract.observability.backend !== "none") {
    checks.push(check("otel-export", true, "Verify logs, metrics, and traces reach the configured observability path."));
  }
  checks.push(check("sandbox-readiness", contract.sandbox.backend !== "none", "Verify the selected sandbox backend can start and run a command."));
  checks.push(check("backup-policy", true, "Verify backup, retention, and restore drill expectations for durable data."));
  checks.push(check("conformance-session", true, "Verify a scripted OpenGeni session can create, stream, replay, run, and complete."));
  return checks;
}

export function requiredRuntimeEnvVars(contract: DeploymentContract): string[] {
  const vars = [
    "OPENGENI_TEMPORAL_NAMESPACE",
    "OPENGENI_TEMPORAL_TASK_QUEUE",
    "OPENGENI_SANDBOX_BACKEND",
  ];
  if (contract.database.mode !== "inCluster") {
    vars.push("OPENGENI_DATABASE_URL");
  }
  if (contract.temporal.mode !== "inCluster") {
    vars.push("OPENGENI_TEMPORAL_HOST");
  }
  if (contract.nats.mode !== "inCluster") {
    vars.push("OPENGENI_NATS_URL");
  }
  if (contract.objectStorage.mode !== "inCluster") {
    vars.push("OPENGENI_OBJECT_STORAGE_BACKEND", "OPENGENI_OBJECT_STORAGE_BUCKET");
    if (contract.objectStorage.api === "s3-compatible") {
      vars.push(
        "OPENGENI_OBJECT_STORAGE_ACCESS_KEY_ID",
        "OPENGENI_OBJECT_STORAGE_ENDPOINT",
        "OPENGENI_OBJECT_STORAGE_REGION",
        "OPENGENI_OBJECT_STORAGE_S3_PROVIDER",
        "OPENGENI_OBJECT_STORAGE_SECRET_ACCESS_KEY",
      );
    } else if (contract.objectStorage.api === "aws-s3") {
      vars.push("OPENGENI_OBJECT_STORAGE_REGION");
    } else if (contract.objectStorage.api === "azure-blob") {
      vars.push("OPENGENI_OBJECT_STORAGE_AZURE_CONNECTION_STRING");
    } else {
      vars.push("OPENGENI_OBJECT_STORAGE_GCS_PROJECT_ID");
    }
  }
  if (contract.runtime.platform === "kubernetes") {
    vars.push("OPENGENI_API_HOST", "OPENGENI_API_PORT");
  }
  if (contract.access.mode === "sharedKey") {
    vars.push("OPENGENI_AUTH_REQUIRED", "OPENGENI_ACCESS_KEY");
  }
  return [...new Set(vars)].sort();
}

export function missingRuntimeEnvVars(
  contract: DeploymentContract,
  env: Record<string, string | undefined> = process.env,
): string[] {
  return requiredRuntimeEnvVars(contract).filter((name) => {
    const value = env[name];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

export function stackPlanFor(contract: DeploymentContract): DeploymentStackPlan {
  const terraformRoot = terraformRootFor(contract);
  const helmValuesFile = helmValuesFileFor(contract);
  const platformDependencies = platformDependencyPlans(contract);
  const requiredSecretKeys = [
    ...requiredRuntimeEnvVars(contract).filter((name) => secretLikeRuntimeEnv(name)),
    ...platformDependencies.flatMap((dependency) => dependency.requiredSecretKeys),
  ];
  return {
    profile: contract.profile,
    terraformRoot,
    helmValuesFile,
    platformDependencies,
    creates: createdResourceClasses(contract),
    externalDependencies: externalDependencies(contract),
    requiredSecretKeys,
    deployCommands: deployCommands(contract, terraformRoot, helmValuesFile, platformDependencies),
    verifyCommands: verifyCommands(contract, platformDependencies),
    destroyCommands: destroyCommands(contract, terraformRoot, platformDependencies),
    notes: planNotes(contract),
  };
}

export function generateRuntimeArtifacts(
  contract: DeploymentContract,
  terraformOutputs: TerraformOutputs,
  env: Record<string, string | undefined> = process.env,
): DeploymentRuntimeArtifacts {
  const helmSetValues = terraformOutputObject(terraformOutputs, "helm_set_values");
  addGeneratedImageValues(helmSetValues, env.OPENGENI_IMAGE_TAG ?? "latest");
  const helmValues = nestedObjectFromHelmSetValues(helmSetValues);
  const runtimeValues = runtimeEnvValues(contract, terraformOutputs, env);
  const missingEnvVars = runtimeValues
    .filter((entry) => entry.required && !entry.value)
    .map((entry) => entry.key);
  const requiredEnvVars = runtimeValues
    .filter((entry) => entry.required)
    .map((entry) => entry.key);
  const envLines = runtimeValues.map((entry) => `${entry.key}=${entry.value ?? ""}`);
  const sensitiveTerraformOutputsUsed = runtimeValues
    .filter((entry) => entry.fromSensitiveTerraformOutput)
    .map((entry) => entry.fromSensitiveTerraformOutput as string);

  return {
    profile: contract.profile,
    helmValuesYaml: [
      "# Generated by OpenGeni deployment runtime artifacts. Do not commit generated copies.",
      renderYaml(helmValues).trimEnd(),
      "",
    ].join("\n"),
    runtimeEnv: [
      "# Generated by OpenGeni deployment runtime artifacts. Do not commit generated copies.",
      "# Values in this file are intended for a private Kubernetes Secret.",
      ...envLines,
      "",
    ].join("\n"),
    requiredEnvVars,
    missingEnvVars,
    sensitiveTerraformOutputsUsed,
    summary: {
      helmValueKeys: Object.keys(helmSetValues).sort(),
      runtimeEnvKeys: runtimeValues.map((entry) => entry.key),
      secretNames: ["opengeni-runtime"],
    },
  };
}

function terraformRootFor(contract: DeploymentContract): string | null {
  if (contract.profile.endsWith("existing-services") || !["azure", "aws", "gcp"].includes(contract.runtime.cloud)) {
    return null;
  }
  return `deploy/terraform/${contract.runtime.cloud}`;
}

function helmValuesFileFor(contract: DeploymentContract): string | null {
  if (contract.profile === "local-kubernetes") return "deploy/helm/opengeni/values.local-kubernetes.example.yaml";
  if (contract.profile === "azure-managed") return "deploy/helm/opengeni/values.azure-managed.example.yaml";
  if (contract.profile === "azure-existing-services") return "deploy/helm/opengeni/values.azure-existing-services.example.yaml";
  if (contract.profile === "aws-managed") return "deploy/helm/opengeni/values.aws-managed.example.yaml";
  if (contract.profile === "gcp-managed") return "deploy/helm/opengeni/values.gcp-managed.example.yaml";
  return null;
}

function createdResourceClasses(contract: DeploymentContract): string[] {
  const out = ["OpenGeni Kubernetes namespace", "OpenGeni Helm release", "runtime secret or external secret reference"];
  if (contract.runtime.cloud === "azure" && contract.profile === "azure-managed") {
    out.unshift("Azure resource group", "AKS cluster", "Azure Container Registry", "Azure Key Vault", "Azure Blob container", "optional Azure Database for PostgreSQL");
  } else if (contract.runtime.cloud === "aws" && contract.profile === "aws-managed") {
    out.unshift("EKS cluster", "ECR repositories", "S3 bucket", "AWS Secrets Manager secret", "IAM roles and policies", "optional RDS PostgreSQL");
  } else if (contract.runtime.cloud === "gcp" && contract.profile === "gcp-managed") {
    out.unshift("GKE cluster", "Artifact Registry repository", "GCS bucket", "Secret Manager secret", "IAM service accounts and bindings", "optional Cloud SQL PostgreSQL");
  } else if (contract.database.mode === "inCluster" || contract.temporal.mode === "inCluster" || contract.nats.mode === "inCluster" || contract.objectStorage.mode === "inCluster") {
    out.push("disposable in-cluster Postgres/Temporal/NATS/MinIO fixtures");
  }
  if (usesOfficialPlatformChart(contract, "nats")) {
    out.push("official NATS Helm release in opengeni-platform namespace");
  }
  if (usesOfficialPlatformChart(contract, "temporal")) {
    out.push("official Temporal Helm release in opengeni-platform namespace");
  }
  return out;
}

function externalDependencies(contract: DeploymentContract): string[] {
  const out: string[] = [];
  if (contract.database.mode === "external") out.push("Postgres with pgvector reachable through OPENGENI_DATABASE_URL");
  if (contract.temporal.mode === "external" && !usesOfficialPlatformChart(contract, "temporal")) {
    out.push("Temporal Cloud, existing Temporal, or official Temporal Helm chart endpoint");
  }
  if (contract.nats.mode === "external" && !usesOfficialPlatformChart(contract, "nats")) {
    out.push("Existing NATS endpoint or official NATS Helm chart endpoint");
  }
  if (contract.objectStorage.mode === "external") out.push(`${contract.objectStorage.api} object storage credentials and bucket/container`);
  if (contract.ingress.enabled) out.push("Ingress/TLS stack with SSE buffering disabled and 3600s timeouts");
  if (contract.access.mode === "externalGateway") out.push("Gateway-managed authentication and authorization");
  return out;
}

function deployCommands(
  contract: DeploymentContract,
  terraformRoot: string | null,
  helmValuesFile: string | null,
  platformDependencies: PlatformDependencyPlan[],
): string[] {
  if (contract.profile === "local-compose") {
    return ["bun run dev"];
  }
  if (contract.profile === "local-kubernetes") {
    return [
      "docker build --platform linux/amd64 -f docker/opengeni.Dockerfile --target api -t opengeni-api:local-k8s .",
      "docker build --platform linux/amd64 -f docker/opengeni.Dockerfile --target worker -t opengeni-worker:local-k8s .",
      "docker build --platform linux/amd64 -f docker/opengeni.Dockerfile --target web -t opengeni-web:local-k8s .",
      "kind load docker-image opengeni-api:local-k8s opengeni-worker:local-k8s opengeni-web:local-k8s --name ${KIND_CLUSTER_NAME:-opengeni-local}",
      `kubectl create namespace ${contract.runtime.namespace ?? "opengeni-local"} --dry-run=client -o yaml | kubectl apply -f -`,
      `kubectl -n ${contract.runtime.namespace ?? "opengeni-local"} create secret generic opengeni-runtime-local-k8s --from-literal=OPENGENI_ACCESS_KEY="$OPENGENI_ACCESS_KEY" --dry-run=client -o yaml | kubectl apply -f -`,
      `helm upgrade --install ${contract.runtime.releaseName} deploy/helm/opengeni --namespace ${contract.runtime.namespace ?? "opengeni-local"} --values ${helmValuesFile ?? "deploy/helm/opengeni/values.local-kubernetes.example.yaml"}`,
    ];
  }
  const commands: string[] = [
    `kubectl create namespace ${contract.runtime.namespace ?? "opengeni"} --dry-run=client -o yaml | kubectl apply -f -`,
  ];
  if (terraformRoot) {
    commands.unshift(`terraform -chdir=${terraformRoot} init -backend=false`, `terraform -chdir=${terraformRoot} plan -var-file=terraform.tfvars`, `terraform -chdir=${terraformRoot} apply -var-file=terraform.tfvars`);
    commands.push(
      `mkdir -p .agent/generated/${contract.profile}`,
      `terraform -chdir=${terraformRoot} output -json > .agent/generated/${contract.profile}/terraform-output.json`,
      ...imageBuildPushCommands(contract, terraformRoot),
      `OPENGENI_IMAGE_TAG="\${OPENGENI_IMAGE_TAG:-$(git rev-parse --short HEAD)}" bun run deployment:runtime-artifacts -- --profile ${contract.profile} --terraform-output .agent/generated/${contract.profile}/terraform-output.json --out-dir .agent/generated/${contract.profile}`,
      `kubectl -n ${contract.runtime.namespace ?? "opengeni"} create secret generic opengeni-runtime --from-env-file=.agent/generated/${contract.profile}/runtime.env --dry-run=client -o yaml | kubectl apply -f -`,
    );
  }
  for (const dependency of platformDependencies) {
    commands.push(...dependency.installCommands);
  }
  const generatedValuesArg = terraformRoot ? ` --values .agent/generated/${contract.profile}/helm-values.generated.yaml` : "";
  const valuesArg = `${helmValuesFile ? ` --values ${helmValuesFile}` : ""}${generatedValuesArg}`;
  commands.push(`helm upgrade --install ${contract.runtime.releaseName} deploy/helm/opengeni --namespace ${contract.runtime.namespace ?? "opengeni"}${valuesArg}`);
  return commands;
}

function verifyCommands(contract: DeploymentContract, platformDependencies: PlatformDependencyPlan[]): string[] {
  const baseUrl = contract.ingress.enabled ? "https://opengeni.example.com" : "http://127.0.0.1:18080";
  const conformance = `bun run deployment:conformance -- --base-url ${baseUrl}`;
  return [
    ...platformDependencies.flatMap((dependency) => dependency.verifyCommands),
    `bun run deployment:preflight -- --profile ${contract.profile} --check-env`,
    contract.access.mode === "sharedKey"
      ? `OPENGENI_CONFORMANCE_ACCESS_KEY="$OPENGENI_ACCESS_KEY" ${conformance}`
      : conformance,
  ];
}

function imageBuildPushCommands(contract: DeploymentContract, terraformRoot: string): string[] {
  if (contract.runtime.cloud === "azure") {
    return [
      `ACR_LOGIN_SERVER="$(terraform -chdir=${terraformRoot} output -raw acr_login_server)" && ACR_ACCESS_TOKEN="$(az acr login --name "\${ACR_LOGIN_SERVER%%.*}" --expose-token --query accessToken -o tsv)" && printf '%s' "$ACR_ACCESS_TOKEN" | docker login "$ACR_LOGIN_SERVER" --username 00000000-0000-0000-0000-000000000000 --password-stdin`,
      `ACR_LOGIN_SERVER="$(terraform -chdir=${terraformRoot} output -raw acr_login_server)" OPENGENI_IMAGE_TAG="\${OPENGENI_IMAGE_TAG:-$(git rev-parse --short HEAD)}" docker build --platform \${OPENGENI_IMAGE_PLATFORM:-linux/amd64} -f docker/opengeni.Dockerfile --target api -t "$ACR_LOGIN_SERVER/opengeni-api:$OPENGENI_IMAGE_TAG" . && docker push "$ACR_LOGIN_SERVER/opengeni-api:$OPENGENI_IMAGE_TAG"`,
      `ACR_LOGIN_SERVER="$(terraform -chdir=${terraformRoot} output -raw acr_login_server)" OPENGENI_IMAGE_TAG="\${OPENGENI_IMAGE_TAG:-$(git rev-parse --short HEAD)}" docker build --platform \${OPENGENI_IMAGE_PLATFORM:-linux/amd64} -f docker/opengeni.Dockerfile --target worker -t "$ACR_LOGIN_SERVER/opengeni-worker:$OPENGENI_IMAGE_TAG" . && docker push "$ACR_LOGIN_SERVER/opengeni-worker:$OPENGENI_IMAGE_TAG"`,
      `ACR_LOGIN_SERVER="$(terraform -chdir=${terraformRoot} output -raw acr_login_server)" OPENGENI_IMAGE_TAG="\${OPENGENI_IMAGE_TAG:-$(git rev-parse --short HEAD)}" docker build --platform \${OPENGENI_IMAGE_PLATFORM:-linux/amd64} -f docker/opengeni.Dockerfile --target web -t "$ACR_LOGIN_SERVER/opengeni-web:$OPENGENI_IMAGE_TAG" . && docker push "$ACR_LOGIN_SERVER/opengeni-web:$OPENGENI_IMAGE_TAG"`,
    ];
  }
  if (contract.runtime.cloud === "aws") {
    return [
      `AWS_REGION="$(terraform -chdir=${terraformRoot} output -raw region)" && AWS_ACCOUNT_ID="$(terraform -chdir=${terraformRoot} output -raw account_id)" && aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"`,
      `API_IMAGE="$(terraform -chdir=${terraformRoot} output -json ecr_repository_urls | jq -r .api)" OPENGENI_IMAGE_TAG="\${OPENGENI_IMAGE_TAG:-$(git rev-parse --short HEAD)}" docker build --platform \${OPENGENI_IMAGE_PLATFORM:-linux/amd64} -f docker/opengeni.Dockerfile --target api -t "$API_IMAGE:$OPENGENI_IMAGE_TAG" . && docker push "$API_IMAGE:$OPENGENI_IMAGE_TAG"`,
      `WORKER_IMAGE="$(terraform -chdir=${terraformRoot} output -json ecr_repository_urls | jq -r .worker)" OPENGENI_IMAGE_TAG="\${OPENGENI_IMAGE_TAG:-$(git rev-parse --short HEAD)}" docker build --platform \${OPENGENI_IMAGE_PLATFORM:-linux/amd64} -f docker/opengeni.Dockerfile --target worker -t "$WORKER_IMAGE:$OPENGENI_IMAGE_TAG" . && docker push "$WORKER_IMAGE:$OPENGENI_IMAGE_TAG"`,
      `WEB_IMAGE="$(terraform -chdir=${terraformRoot} output -json ecr_repository_urls | jq -r .web)" OPENGENI_IMAGE_TAG="\${OPENGENI_IMAGE_TAG:-$(git rev-parse --short HEAD)}" docker build --platform \${OPENGENI_IMAGE_PLATFORM:-linux/amd64} -f docker/opengeni.Dockerfile --target web -t "$WEB_IMAGE:$OPENGENI_IMAGE_TAG" . && docker push "$WEB_IMAGE:$OPENGENI_IMAGE_TAG"`,
    ];
  }
  if (contract.runtime.cloud === "gcp") {
    return [
      `GCP_IMAGE_REGISTRY="$(terraform -chdir=${terraformRoot} output -json helm_set_values | jq -r '."global.imageRegistry"')" && gcloud auth configure-docker "\${GCP_IMAGE_REGISTRY%%/*}" --quiet`,
      `GCP_IMAGE_REGISTRY="$(terraform -chdir=${terraformRoot} output -json helm_set_values | jq -r '."global.imageRegistry"')" OPENGENI_IMAGE_TAG="\${OPENGENI_IMAGE_TAG:-$(git rev-parse --short HEAD)}" docker build --platform \${OPENGENI_IMAGE_PLATFORM:-linux/amd64} -f docker/opengeni.Dockerfile --target api -t "$GCP_IMAGE_REGISTRY/opengeni-api:$OPENGENI_IMAGE_TAG" . && docker push "$GCP_IMAGE_REGISTRY/opengeni-api:$OPENGENI_IMAGE_TAG"`,
      `GCP_IMAGE_REGISTRY="$(terraform -chdir=${terraformRoot} output -json helm_set_values | jq -r '."global.imageRegistry"')" OPENGENI_IMAGE_TAG="\${OPENGENI_IMAGE_TAG:-$(git rev-parse --short HEAD)}" docker build --platform \${OPENGENI_IMAGE_PLATFORM:-linux/amd64} -f docker/opengeni.Dockerfile --target worker -t "$GCP_IMAGE_REGISTRY/opengeni-worker:$OPENGENI_IMAGE_TAG" . && docker push "$GCP_IMAGE_REGISTRY/opengeni-worker:$OPENGENI_IMAGE_TAG"`,
      `GCP_IMAGE_REGISTRY="$(terraform -chdir=${terraformRoot} output -json helm_set_values | jq -r '."global.imageRegistry"')" OPENGENI_IMAGE_TAG="\${OPENGENI_IMAGE_TAG:-$(git rev-parse --short HEAD)}" docker build --platform \${OPENGENI_IMAGE_PLATFORM:-linux/amd64} -f docker/opengeni.Dockerfile --target web -t "$GCP_IMAGE_REGISTRY/opengeni-web:$OPENGENI_IMAGE_TAG" . && docker push "$GCP_IMAGE_REGISTRY/opengeni-web:$OPENGENI_IMAGE_TAG"`,
    ];
  }
  return [];
}

function destroyCommands(
  contract: DeploymentContract,
  terraformRoot: string | null,
  platformDependencies: PlatformDependencyPlan[],
): string[] {
  if (contract.profile === "local-compose") {
    return ["docker compose down --remove-orphans"];
  }
  const commands = [
    `helm uninstall ${contract.runtime.releaseName} --namespace ${contract.runtime.namespace ?? "opengeni"} --ignore-not-found`,
    `kubectl delete namespace ${contract.runtime.namespace ?? "opengeni"} --ignore-not-found`,
  ];
  for (const dependency of [...platformDependencies].reverse()) {
    commands.push(...dependency.destroyCommands);
  }
  if (platformDependencies.length > 0) {
    commands.push("kubectl delete namespace opengeni-platform --ignore-not-found");
  }
  if (terraformRoot) {
    commands.push(`terraform -chdir=${terraformRoot} destroy -var-file=terraform.tfvars`);
  }
  return commands;
}

function platformDependencyPlans(contract: DeploymentContract): PlatformDependencyPlan[] {
  if (!["azure-managed", "aws-managed", "gcp-managed", "self-contained-kubernetes"].includes(contract.profile)) {
    return [];
  }
  if (contract.runtime.platform !== "kubernetes") {
    return [];
  }
  const namespace = "opengeni-platform";
  const out: PlatformDependencyPlan[] = [];
  if (contract.nats.mode === "external") {
    out.push({
      id: "nats",
      lifecycle: "officialChart",
      namespace,
      releaseName: "opengeni-nats",
      chartRepoName: "nats",
      chartRepoUrl: "https://nats-io.github.io/k8s/helm/charts",
      chartName: "nats/nats",
      valuesFile: "deploy/stacks/official-nats.values.yaml",
      runtimeEnv: {
        OPENGENI_NATS_URL: "nats://opengeni-nats.opengeni-platform.svc.cluster.local:4222",
      },
      requiredEnvVars: [],
      requiredSecretKeys: [],
      installCommands: [
        "helm repo add nats https://nats-io.github.io/k8s/helm/charts",
        "helm repo update nats",
        "kubectl create namespace opengeni-platform --dry-run=client -o yaml | kubectl apply -f -",
        "helm upgrade --install opengeni-nats nats/nats --namespace opengeni-platform --values deploy/stacks/official-nats.values.yaml",
        "kubectl apply -f deploy/stacks/opengeni-platform-networkpolicies.yaml",
      ],
      verifyCommands: [
        "kubectl -n opengeni-platform rollout status statefulset/opengeni-nats --timeout=180s",
        "kubectl -n opengeni-platform get svc opengeni-nats",
        "helm test opengeni-nats --namespace opengeni-platform --timeout 180s",
      ],
      destroyCommands: [
        "helm uninstall opengeni-nats --namespace opengeni-platform --ignore-not-found",
      ],
      notes: [
        "The official NATS chart is lifecycle-managed by the stack wrapper, not by the OpenGeni app chart.",
        "The service is ClusterIP-only; do not expose NATS with LoadBalancer or public ingress for the default stack.",
      ],
    });
  }
  if (contract.temporal.mode === "external") {
    const temporalValuesCommand = contract.runtime.cloud === "aws"
      ? `TEMPORAL_POSTGRES_TLS_ENABLED="\${TEMPORAL_POSTGRES_TLS_ENABLED:-true}" TEMPORAL_POSTGRES_TLS_CA_FILE="\${TEMPORAL_POSTGRES_TLS_CA_FILE:-/etc/opengeni/postgres-ca/ca.pem}" TEMPORAL_POSTGRES_TLS_CA_CONFIG_MAP_NAME="\${TEMPORAL_POSTGRES_TLS_CA_CONFIG_MAP_NAME:-opengeni-postgres-ca}" bun run deployment:temporal-values -- --out .agent/generated/${contract.profile}/official-temporal-postgres.values.yaml`
      : `bun run deployment:temporal-values -- --out .agent/generated/${contract.profile}/official-temporal-postgres.values.yaml`;
    const temporalTlsPrepCommands = contract.runtime.cloud === "aws"
      ? [
        `curl -fsSL https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o .agent/generated/${contract.profile}/rds-global-bundle.pem`,
        `kubectl -n opengeni-platform create configmap opengeni-postgres-ca --from-file=ca.pem=.agent/generated/${contract.profile}/rds-global-bundle.pem --dry-run=client -o yaml | kubectl apply -f -`,
      ]
      : [];
    out.push({
      id: "temporal",
      lifecycle: "officialChart",
      namespace,
      releaseName: "opengeni-temporal",
      chartRepoName: "temporal",
      chartRepoUrl: "https://go.temporal.io/helm-charts",
      chartName: "temporal/temporal",
      valuesFile: "deploy/stacks/official-temporal-postgres.values.example.yaml",
      runtimeEnv: {
        OPENGENI_TEMPORAL_HOST: "opengeni-temporal-frontend.opengeni-platform.svc.cluster.local:7233",
      },
      requiredEnvVars: ["TEMPORAL_POSTGRES_HOST", "TEMPORAL_POSTGRES_PASSWORD"],
      requiredSecretKeys: ["opengeni-temporal-postgres/password"],
      installCommands: [
        "helm repo add temporal https://go.temporal.io/helm-charts",
        "helm repo update temporal",
        "kubectl create namespace opengeni-platform --dry-run=client -o yaml | kubectl apply -f -",
        `mkdir -p .agent/generated/${contract.profile}`,
        ...temporalTlsPrepCommands,
        temporalValuesCommand,
        "kubectl -n opengeni-platform create secret generic opengeni-temporal-postgres --from-literal=password=\"$TEMPORAL_POSTGRES_PASSWORD\" --dry-run=client -o yaml | kubectl apply -f -",
        `helm upgrade --install opengeni-temporal temporal/temporal --namespace opengeni-platform --values .agent/generated/${contract.profile}/official-temporal-postgres.values.yaml`,
        "kubectl -n opengeni-platform delete job opengeni-temporal-register-default-namespace --ignore-not-found",
        "kubectl apply -f deploy/stacks/official-temporal-namespace-job.yaml",
        "kubectl -n opengeni-platform wait --for=condition=complete job/opengeni-temporal-register-default-namespace --timeout=180s",
        "kubectl apply -f deploy/stacks/opengeni-platform-networkpolicies.yaml",
      ],
      verifyCommands: [
        "kubectl -n opengeni-platform rollout status deployment/opengeni-temporal-frontend --timeout=300s",
        "kubectl -n opengeni-platform exec deploy/opengeni-temporal-admintools -- temporal operator namespace describe default --address opengeni-temporal-frontend:7233",
        "kubectl -n opengeni-platform get svc opengeni-temporal-frontend",
        "helm test opengeni-temporal --namespace opengeni-platform --timeout 300s",
      ],
      destroyCommands: [
        "helm uninstall opengeni-temporal --namespace opengeni-platform --ignore-not-found",
      ],
      notes: [
        "The official Temporal chart is lifecycle-managed by the stack wrapper, not by the OpenGeni app chart.",
        "The example values require an existing Postgres database/schema pair for Temporal persistence; use managed cloud Postgres or a customer database, not the OpenGeni chart's disposable Postgres fixture.",
      ],
    });
  }
  return out;
}

function usesOfficialPlatformChart(contract: DeploymentContract, id: PlatformDependencyPlan["id"]): boolean {
  return platformDependencyPlans(contract).some((dependency) => dependency.id === id && dependency.lifecycle === "officialChart");
}

function planNotes(contract: DeploymentContract): string[] {
  const notes = [
    "Keep provider resource names, generated credentials, kubeconfigs, Terraform state, and filled tfvars in private operator-controlled storage outside the repository.",
    "Use the generated destroy commands as the baseline cleanup path for environments created from this plan.",
  ];
  if (contract.access.mode === "sharedKey") {
    notes.push("Generate OPENGENI_ACCESS_KEY outside source control and provide it through the runtime secret path.");
  }
  if (contract.nats.mode === "external") {
    notes.push("NATS is intentionally outside the OpenGeni app chart; use an existing endpoint or the official NATS Helm chart.");
  }
  if (contract.temporal.mode === "external") {
    notes.push("Temporal is intentionally outside the OpenGeni app chart; use Temporal Cloud, an existing endpoint, or the official Temporal Helm chart.");
  }
  return notes;
}

function secretLikeRuntimeEnv(name: string): boolean {
  return name.includes("KEY") || name.includes("SECRET") || name.includes("TOKEN") || name.includes("PASSWORD") || name.includes("CONNECTION_STRING") || name === "OPENGENI_DATABASE_URL";
}

function check(id: PreflightCheckId, required: boolean, description: string): PreflightCheck {
  return { id, required, description };
}

function requireModeReference(
  ctx: z.RefinementCtx,
  path: Array<string | number>,
  mode: DependencyMode,
  external: ExternalServiceRef | undefined,
  managed: ManagedServiceRef | undefined,
): void {
  if (mode === "external" && !external) {
    ctx.addIssue({
      code: "custom",
      path: [...path, "external"],
      message: "external mode requires an external service reference",
    });
  }
  if (mode === "managed" && !managed) {
    ctx.addIssue({
      code: "custom",
      path: [...path, "managed"],
      message: "managed mode requires a managed service reference",
    });
  }
}

interface RuntimeEnvEntry {
  key: string;
  value: string | undefined;
  required: boolean;
  fromSensitiveTerraformOutput?: string;
}

function runtimeEnvValues(
  contract: DeploymentContract,
  terraformOutputs: TerraformOutputs,
  env: Record<string, string | undefined>,
): RuntimeEnvEntry[] {
  const entries: RuntimeEnvEntry[] = [
    requiredEnv("OPENGENI_ACCESS_KEY", env.OPENGENI_ACCESS_KEY),
    requiredEnv("OPENGENI_DATABASE_URL", env.OPENGENI_DATABASE_URL),
    valueEnv("OPENGENI_AUTH_REQUIRED", "true"),
    valueEnv("OPENGENI_AUTH_ALLOW_HEALTH", String(contract.access.allowUnauthenticatedHealth)),
    valueEnv("OPENGENI_AUTH_ALLOW_METRICS", String(contract.access.allowUnauthenticatedMetrics)),
    valueEnv("OPENGENI_TEMPORAL_HOST", terraformOutputString(terraformOutputs, "temporal_host") ?? platformRuntimeEnv(contract, "OPENGENI_TEMPORAL_HOST")),
    valueEnv("OPENGENI_TEMPORAL_NAMESPACE", terraformOutputString(terraformOutputs, "temporal_namespace") ?? contract.temporal.namespace),
    valueEnv("OPENGENI_TEMPORAL_TASK_QUEUE", terraformOutputString(terraformOutputs, "temporal_task_queue") ?? contract.temporal.taskQueue),
    valueEnv("OPENGENI_NATS_URL", platformRuntimeEnv(contract, "OPENGENI_NATS_URL") ?? env.OPENGENI_NATS_URL),
    valueEnv("OPENGENI_API_HOST", "0.0.0.0"),
    valueEnv("OPENGENI_API_PORT", "8000"),
    valueEnv("OPENGENI_SANDBOX_BACKEND", contract.sandbox.backend),
  ];

  if (contract.objectStorage.api === "azure-blob") {
    const output = terraformOutputs.object_storage_azure_connection_string;
    const connectionStringEntry: RuntimeEnvEntry = {
      key: "OPENGENI_OBJECT_STORAGE_AZURE_CONNECTION_STRING",
      value: env.OPENGENI_OBJECT_STORAGE_AZURE_CONNECTION_STRING ?? terraformOutputString(terraformOutputs, "object_storage_azure_connection_string"),
      required: true,
    };
    if (output?.sensitive) {
      connectionStringEntry.fromSensitiveTerraformOutput = "object_storage_azure_connection_string";
    }
    entries.push(
      valueEnv("OPENGENI_OBJECT_STORAGE_BACKEND", "azure-blob"),
      valueEnv("OPENGENI_OBJECT_STORAGE_BUCKET", terraformOutputString(terraformOutputs, "object_storage_bucket") ?? contract.objectStorage.bucket),
      connectionStringEntry,
    );
  } else if (contract.objectStorage.api === "aws-s3") {
    entries.push(
      valueEnv("OPENGENI_OBJECT_STORAGE_BACKEND", "aws-s3"),
      valueEnv("OPENGENI_OBJECT_STORAGE_BUCKET", terraformOutputString(terraformOutputs, "object_storage_bucket") ?? contract.objectStorage.bucket),
      valueEnv("OPENGENI_OBJECT_STORAGE_REGION", terraformOutputString(terraformOutputs, "region") ?? contract.runtime.region ?? env.AWS_REGION ?? "us-east-1"),
      valueEnv("OPENGENI_OBJECT_STORAGE_FORCE_PATH_STYLE", "false"),
    );
  } else if (contract.objectStorage.api === "gcs") {
    entries.push(
      valueEnv("OPENGENI_OBJECT_STORAGE_BACKEND", "gcs"),
      valueEnv("OPENGENI_OBJECT_STORAGE_BUCKET", terraformOutputString(terraformOutputs, "object_storage_bucket") ?? contract.objectStorage.bucket),
      valueEnv("OPENGENI_OBJECT_STORAGE_GCS_PROJECT_ID", terraformOutputString(terraformOutputs, "project_id") ?? env.GOOGLE_CLOUD_PROJECT),
    );
  } else {
    entries.push(
      valueEnv("OPENGENI_OBJECT_STORAGE_BACKEND", "s3-compatible"),
      valueEnv("OPENGENI_OBJECT_STORAGE_BUCKET", terraformOutputString(terraformOutputs, "object_storage_bucket") ?? contract.objectStorage.bucket),
      requiredEnv("OPENGENI_OBJECT_STORAGE_ENDPOINT", env.OPENGENI_OBJECT_STORAGE_ENDPOINT),
      requiredEnv("OPENGENI_OBJECT_STORAGE_ACCESS_KEY_ID", env.OPENGENI_OBJECT_STORAGE_ACCESS_KEY_ID),
      requiredEnv("OPENGENI_OBJECT_STORAGE_SECRET_ACCESS_KEY", env.OPENGENI_OBJECT_STORAGE_SECRET_ACCESS_KEY),
      valueEnv("OPENGENI_OBJECT_STORAGE_REGION", env.OPENGENI_OBJECT_STORAGE_REGION ?? "us-east-1"),
      valueEnv("OPENGENI_OBJECT_STORAGE_S3_PROVIDER", env.OPENGENI_OBJECT_STORAGE_S3_PROVIDER ?? "S3Compatible"),
    );
  }

  return dedupeRuntimeEnv(entries);
}

function platformRuntimeEnv(contract: DeploymentContract, key: string): string | undefined {
  for (const dependency of platformDependencyPlans(contract)) {
    const value = dependency.runtimeEnv[key];
    if (value) return value;
  }
  return undefined;
}

function requiredEnv(key: string, value: string | undefined): RuntimeEnvEntry {
  return { key, value: nonEmpty(value), required: true };
}

function valueEnv(key: string, value: string | undefined): RuntimeEnvEntry {
  return { key, value: nonEmpty(value), required: false };
}

function nonEmpty(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function dedupeRuntimeEnv(entries: RuntimeEnvEntry[]): RuntimeEnvEntry[] {
  const byKey = new Map<string, RuntimeEnvEntry>();
  for (const entry of entries) {
    const existing = byKey.get(entry.key);
    if (!existing || (!existing.value && entry.value)) {
      byKey.set(entry.key, entry);
    }
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function terraformOutputString(outputs: TerraformOutputs, name: string): string | undefined {
  const value = outputs[name]?.value;
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function terraformOutputObject(outputs: TerraformOutputs, name: string): Record<string, string> {
  const value = outputs[name]?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && item.trim().length > 0) {
      out[key] = item;
    }
  }
  return out;
}

function addGeneratedImageValues(values: Record<string, string>, tag: string): void {
  for (const component of ["api", "worker", "web", "migrations"]) {
    values[`${component}.image.tag`] = tag;
    values[`${component}.image.digest`] = "";
  }
}

function nestedObjectFromHelmSetValues(values: Record<string, string>): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(values)) {
    setNestedValue(root, splitHelmSetPath(path), value);
  }
  return root;
}

function splitHelmSetPath(path: string): string[] {
  const out: string[] = [];
  let current = "";
  for (let index = 0; index < path.length; index += 1) {
    const char = path[index];
    if (char === "\\" && path[index + 1] === ".") {
      current += ".";
      index += 1;
      continue;
    }
    if (char === ".") {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return out.filter((part) => part.length > 0);
}

function setNestedValue(root: Record<string, unknown>, path: string[], value: string): void {
  let cursor = root;
  for (let index = 0; index < path.length; index += 1) {
    const key = path[index];
    if (!key) {
      continue;
    }
    if (index === path.length - 1) {
      cursor[key] = value;
      return;
    }
    const next = cursor[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
}

function renderYaml(value: unknown, indent = 0): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return `${" ".repeat(indent)}${yamlValue(value)}\n`;
  }
  const lines: string[] = [];
  for (const [key, item] of Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      lines.push(`${" ".repeat(indent)}${key}:\n${renderYaml(item, indent + 2)}`);
    } else {
      lines.push(`${" ".repeat(indent)}${key}: ${yamlValue(item)}\n`);
    }
  }
  return lines.join("");
}

function yamlValue(value: unknown): string {
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value !== "string") return "null";
  return JSON.stringify(value);
}
