import { GSMSecretProvider, type SecretLookupOptions } from "@linktrend/linklogic";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_SECRET_NAME: z
    .string()
    .default("LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE"),
  N8N_WEBHOOK_URL: z.string().url().optional(),
  LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN: z.string().min(20).optional(),
  POSTMARK_SERVER_TOKEN_SECRET_NAME: z
    .string()
    .default("LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN"),
  LINKTREND_AIOS_PROD_OPENROUTER_API_KEY: z.string().min(20).optional(),
  OPENROUTER_API_KEY_SECRET_NAME: z.string().default("LINKTREND_AIOS_PROD_OPENROUTER_API_KEY"),
  LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY: z.string().min(20).optional(),
  ANTHROPIC_API_KEY_SECRET_NAME: z.string().default("LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY"),
  AIOS_INGRESS_TOKEN: z.string().min(16).optional(),
  AIOS_INGRESS_TOKEN_SECRET_NAME: z.string().default("AIOS_INGRESS_TOKEN"),
  NATS_URL: z.string().url().optional(),
  LINKSKILLS_API_URL: z.string().url().optional(),
  LINKSKILLS_API_TOKEN: z.string().min(16).optional(),
  LINKSKILLS_API_TOKEN_SECRET_NAME: z.string().default("LINKSKILLS_API_TOKEN"),
  LINKSKILLS_PRINCIPAL_ID: z.string().min(3).default("linktrend-internal-agent"),
  LINKSKILLS_BILLING_TRACK: z.enum(["track_1", "track_2"]).default("track_1"),
  LINKSKILLS_VENTURE_ID: z.string().min(3).default("linktrend_internal"),
  LINKSKILLS_CLIENT_ID: z.string().min(3).optional(),
  LINKSKILLS_DEFAULT_STEP_SCOPE: z.string().default("phase.execute"),
  SLACK_OPERATIONS_WEBHOOK_URL: z.string().url().optional(),
  SLACK_OPERATIONS_WEBHOOK_SECRET_NAME: z
    .string()
    .default("SLACK_OPERATIONS_WEBHOOK_URL"),
  SLACK_APPROVALS_WEBHOOK_URL: z.string().url().optional(),
  SLACK_APPROVALS_WEBHOOK_SECRET_NAME: z
    .string()
    .default("SLACK_APPROVALS_WEBHOOK_URL"),
  SLACK_CHANNEL_OPERATIONS: z.string().default("#aios-ops"),
  SLACK_CHANNEL_APPROVALS: z.string().default("#aios-approvals"),
  SLACK_CHANNEL_STRATEGIC: z.string().default("#aios-approvals"),
  SLACK_CHANNEL_OPERATIONAL: z.string().default("#aios-ops"),
  SLACK_CHANNEL_QUALITY: z.string().default("#aios-ops"),
  CHAIRMAN_APPROVAL_TIME: z.string().default("08:00"),
  OPERATIONAL_PULSE_TIME: z.string().default("10:45"),
  QUALITY_GATE_TIME: z.string().default("14:45"),
  CHAIRMAN_APPROVAL_TIMEZONE: z.string().default("Asia/Taipei"),
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
  AIOS_INGRESS_TOKEN: string;
  LINKSKILLS_API_TOKEN?: string;
  SLACK_OPERATIONS_WEBHOOK_URL?: string;
  SLACK_APPROVALS_WEBHOOK_URL?: string;
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

  const [supabaseKey, postmarkKey, openrouterKey, anthropicKey, ingressToken] = await Promise.all([
    provider.getSecret(parsed.SUPABASE_SERVICE_ROLE_SECRET_NAME, { env }),
    provider.getSecret(parsed.POSTMARK_SERVER_TOKEN_SECRET_NAME, { env }),
    provider.getSecret(parsed.OPENROUTER_API_KEY_SECRET_NAME, { env }),
    provider.getSecret(parsed.ANTHROPIC_API_KEY_SECRET_NAME, { env }),
    provider.getSecret(parsed.AIOS_INGRESS_TOKEN_SECRET_NAME, { env })
  ]);

  const linkskillsToken = await resolveOptionalSecret(provider, {
    secretName: parsed.LINKSKILLS_API_TOKEN_SECRET_NAME,
    fallbackEnvVar: "LINKSKILLS_API_TOKEN",
    env,
    required: Boolean(parsed.LINKSKILLS_API_URL)
  });

  const slackOpsWebhook = await resolveOptionalSecret(provider, {
    secretName: parsed.SLACK_OPERATIONS_WEBHOOK_SECRET_NAME,
    fallbackEnvVar: "SLACK_OPERATIONS_WEBHOOK_URL",
    env,
    required: false
  });

  const slackApprovalsWebhook = await resolveOptionalSecret(provider, {
    secretName: parsed.SLACK_APPROVALS_WEBHOOK_SECRET_NAME,
    fallbackEnvVar: "SLACK_APPROVALS_WEBHOOK_URL",
    env,
    required: false
  });

  return {
    ...parsed,
    LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE: supabaseKey,
    LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN: postmarkKey,
    LINKTREND_AIOS_PROD_OPENROUTER_API_KEY: openrouterKey,
    LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY: anthropicKey,
    AIOS_INGRESS_TOKEN: ingressToken,
    LINKSKILLS_API_TOKEN: linkskillsToken,
    SLACK_OPERATIONS_WEBHOOK_URL: slackOpsWebhook,
    SLACK_APPROVALS_WEBHOOK_URL: slackApprovalsWebhook,
    POSTMARK_SERVER_TOKEN: postmarkKey,
    OPENROUTER_API_KEY: openrouterKey,
    ANTHROPIC_API_KEY: anthropicKey
  };
}

async function resolveOptionalSecret(
  provider: SecretProviderLike,
  args: {
    secretName: string;
    fallbackEnvVar: string;
    env: NodeJS.ProcessEnv;
    required: boolean;
  }
): Promise<string | undefined> {
  try {
    return await provider.getSecret(args.secretName, {
      fallbackEnvVar: args.fallbackEnvVar,
      env: args.env
    });
  } catch (error) {
    if (!args.required) {
      return undefined;
    }
    throw error;
  }
}
