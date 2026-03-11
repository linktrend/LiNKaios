import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  N8N_WEBHOOK_URL: z.string().url(),
  POSTMARK_SERVER_TOKEN: z.string().min(20),
  OLLAMA_EMBEDDING_URL: z.string().url(),
  OLLAMA_EMBEDDING_MODEL: z.string().default("nomic-embed-text")
});

export function loadEnv(env: NodeJS.ProcessEnv) {
  return EnvSchema.parse(env);
}
