import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

export type SecretLookupOptions = {
  fallbackEnvVar?: string;
  env?: NodeJS.ProcessEnv;
};

type SecretManagerClientLike = Pick<SecretManagerServiceClient, "accessSecretVersion">;

export class GSMSecretProvider {
  private readonly projectId?: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly client: SecretManagerClientLike;

  constructor(options?: {
    projectId?: string;
    env?: NodeJS.ProcessEnv;
    client?: SecretManagerClientLike;
  }) {
    this.env = options?.env ?? process.env;
    this.projectId = options?.projectId ?? this.env.GOOGLE_CLOUD_PROJECT ?? this.env.GCP_PROJECT;
    this.client = options?.client ?? new SecretManagerServiceClient();
  }

  async getSecret(secretName: string, options?: SecretLookupOptions): Promise<string> {
    if (!secretName) {
      throw new Error("Secret name is required");
    }

    const runtimeEnv = options?.env ?? this.env;
    const fallbackEnvVar = options?.fallbackEnvVar ?? secretName;
    const localValue = runtimeEnv[fallbackEnvVar];

    if (localValue && localValue.length > 0) {
      return localValue;
    }

    if (!this.projectId) {
      throw new Error(
        `GOOGLE_CLOUD_PROJECT or GCP_PROJECT is required to resolve secret '${secretName}'`
      );
    }

    const resourceName = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
    const [version] = await this.client.accessSecretVersion({ name: resourceName });
    const value = version.payload?.data?.toString();

    if (!value) {
      throw new Error(`Secret '${secretName}' has no readable payload in GSM`);
    }

    return value;
  }
}

const defaultSecretProvider = new GSMSecretProvider();

export async function getSecret(secretName: string): Promise<string> {
  return defaultSecretProvider.getSecret(secretName);
}
