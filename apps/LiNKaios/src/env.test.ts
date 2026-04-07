import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("LiNKaios env", () => {
  it("loads required environment variables from GSM secret names", async () => {
    const env = await loadEnv(
      {
        PORT: "4000",
        SUPABASE_URL: "https://example.supabase.co",
        OLLAMA_EMBEDDING_URL: "http://100.100.100.2:11434/api/embeddings",
        OLLAMA_EMBEDDING_MODEL: "nomic-embed-text"
      },
      {
        getSecret: async (secretName) => `gsm:${secretName}`
      }
    );

    expect(env.PORT).toBe(4000);
    expect(env.SUPABASE_URL).toContain("supabase");
    expect(env.LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE).toBe(
      "gsm:LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE"
    );
    expect(env.OPENROUTER_API_KEY).toBe("gsm:LINKTREND_AIOS_PROD_OPENROUTER_API_KEY");
    expect(env.N8N_WEBHOOK_URL).toBeUndefined();
  });

  it("accepts optional N8N_WEBHOOK_URL when n8n is configured", async () => {
    const env = await loadEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        N8N_WEBHOOK_URL: "https://n8n.internal/webhook/urgent",
        OLLAMA_EMBEDDING_URL: "http://100.100.100.2:11434/api/embeddings"
      },
      { getSecret: async (secretName) => `gsm:${secretName}` }
    );
    expect(env.N8N_WEBHOOK_URL).toBe("https://n8n.internal/webhook/urgent");
  });
});
