import { GSMSecretProvider, type SecretLookupOptions } from "@linktrend/linklogic";
import { z } from "zod";

const EnvSchema = z.object({
  N8N_PORT: z.coerce.number().default(5678),
  SUPABASE_URL: z.string().url(),
  LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_SECRET_NAME: z
    .string()
    .default("LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE"),
  LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN: z.string().min(20).optional(),
  POSTMARK_SERVER_TOKEN_SECRET_NAME: z
    .string()
    .default("LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN"),
  LINKTREND_AIOS_PROD_OPENROUTER_API_KEY: z.string().min(20).optional(),
  OPENROUTER_API_KEY_SECRET_NAME: z.string().default("LINKTREND_AIOS_PROD_OPENROUTER_API_KEY"),
  GOOGLE_CLOUD_PROJECT: z.string().min(1).optional(),
  GCP_PROJECT: z.string().min(1).optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1).optional()
});

type RawEnvShape = z.infer<typeof EnvSchema>;
type ResolvedEnvShape = RawEnvShape & {
  LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE: string;
  LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN: string;
  LINKTREND_AIOS_PROD_OPENROUTER_API_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  POSTMARK_SERVER_TOKEN: string;
  OPENROUTER_API_KEY: string;
};

type SecretProviderLike = {
  getSecret(secretName: string, options?: SecretLookupOptions): Promise<string>;
};

export async function loadLiNKautoworkEnv(
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

  const [supabaseKey, postmarkKey, openrouterKey] = await Promise.all([
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
    })
  ]);

  return {
    ...parsed,
    LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE: supabaseKey,
    LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN: postmarkKey,
    LINKTREND_AIOS_PROD_OPENROUTER_API_KEY: openrouterKey,
    SUPABASE_SERVICE_ROLE_KEY: supabaseKey,
    POSTMARK_SERVER_TOKEN: postmarkKey,
    OPENROUTER_API_KEY: openrouterKey
  };
}
