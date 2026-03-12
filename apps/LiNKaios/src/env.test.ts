import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("LiNKaios env", () => {
  it("loads required environment variables with MVO fallback", async () => {
    const env = await loadEnv(
      {
        PORT: "4000",
        SUPABASE_URL: "https://example.supabase.co",
        LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE: "sb_secret_example_1234567890",
        N8N_WEBHOOK_URL: "https://n8n.internal/webhook/urgent",
        LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN: "pm_server_token_1234567890",
        LINKTREND_AIOS_PROD_OPENROUTER_API_KEY: "openrouter_key_1234567890",
        LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY: "anthropic_key_1234567890",
        AIOS_INGRESS_TOKEN: "test_ingress_token_123456",
        OLLAMA_EMBEDDING_URL: "http://100.100.100.2:11434/api/embeddings",
        OLLAMA_EMBEDDING_MODEL: "nomic-embed-text"
      },
      {
        getSecret: async (secretName, options) => {
          if (options?.fallbackEnvVar) {
            const v = options.env?.[options.fallbackEnvVar];
            if (v) {
              return v;
            }
          }
          return `gsm:${secretName}`;
        }
      }
    );

    expect(env.PORT).toBe(4000);
    expect(env.SUPABASE_URL).toContain("supabase");
    expect(env.LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE).toContain("sb_secret");
    expect(env.OPENROUTER_API_KEY).toContain("openrouter");
  });
});
