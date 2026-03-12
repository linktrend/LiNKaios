import { GSMSecretProvider, type SecretLookupOptions } from "@linktrend/linklogic";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_SECRET_NAME: z
    .string()
    .default("LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE"),
  N8N_WEBHOOK_URL: z.string().url(),
  LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN: z.string().min(20).optional(),
  POSTMARK_SERVER_TOKEN_SECRET_NAME: z
    .string()
    .default("LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN"),
  LINKTREND_AIOS_PROD_OPENROUTER_API_KEY: z.string().min(20).optional(),
  OPENROUTER_API_KEY_SECRET_NAME: z.string().default("LINKTREND_AIOS_PROD_OPENROUTER_API_KEY"),
  LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY: z.string().min(20).optional(),
  ANTHROPIC_API_KEY_SECRET_NAME: z.string().default("LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY"),
  AIOS_INGRESS_TOKEN: z.string().min(16),
  OLLAMA_EMBEDDING_URL: z.string().url(),
  OLLAMA_EMBEDDING_MODEL: z.string().default("nomic-embed-text"),
  LINKBOARD_URL: z.string().url().optional(),
  GOOGLE_CLOUD_PROJECT: z.string().min(1).optional(),
  GCP_PROJECT: z.string().min(1).optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional()
});

type RawEnvShape = z.infer<typeof EnvSchema>;
type ResolvedEnvShape = RawEnvShape & {
  LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE: string;
  LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN: string;
  LINKTREND_AIOS_PROD_OPENROUTER_API_KEY: string;
  LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY: string;
  POSTMARK_SERVER_TOKEN: string;
  OPENROUTER_API_KEY: string;
  ANTHROPIC_API_KEY: string;
};

type SecretProviderLike = {
  getSecret(secretName: string, options?: SecretLookupOptions): Promise<string>;
};

export async function loadEnv(
  env: NodeJS.ProcessEnv,
  secretProvider?: SecretProviderLike
): Promise<ResolvedEnvShape> {
  const parsed = EnvSchema.parse(env);

  const provider =
    secretProvider ??
    new GSMSecretProvider({
      projectId: parsed.GOOGLE_CLOUD_PROJECT ?? parsed.GCP_PROJECT,
      env
    });

  const [supabaseKey, postmarkKey, openrouterKey, anthropicKey] = await Promise.all([
    provider.getSecret(parsed.SUPABASE_SERVICE_ROLE_SECRET_NAME, {
      fallbackEnvVar: "LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE",
      env
    }),
    provider.getSecret(parsed.POSTMARK_SERVER_TOKEN_SECRET_NAME, {
      fallbackEnvVar: "LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN",
      env
    }),
    provider.getSecret(parsed.OPENROUTER_API_KEY_SECRET_NAME, {
      fallbackEnvVar: "LINKTREND_AIOS_PROD_OPENROUTER_API_KEY",
      env
    }),
    provider.getSecret(parsed.ANTHROPIC_API_KEY_SECRET_NAME, {
      fallbackEnvVar: "LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY",
      env
    })
  ]);

  return {
    ...parsed,
    LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE: supabaseKey,
    LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN: postmarkKey,
    LINKTREND_AIOS_PROD_OPENROUTER_API_KEY: openrouterKey,
    LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY: anthropicKey,
    POSTMARK_SERVER_TOKEN: postmarkKey,
    OPENROUTER_API_KEY: openrouterKey,
    ANTHROPIC_API_KEY: anthropicKey
  };
}
