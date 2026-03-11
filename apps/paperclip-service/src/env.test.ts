import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

describe("paperclip env", () => {
  it("loads required environment variables", () => {
    const env = loadEnv({
      PORT: "4000",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "sb_secret_example_1234567890",
      N8N_WEBHOOK_URL: "https://n8n.internal/webhook/urgent",
      POSTMARK_SERVER_TOKEN: "pm_server_token_1234567890",
      OLLAMA_EMBEDDING_URL: "http://100.100.100.2:11434/api/embeddings",
      OLLAMA_EMBEDDING_MODEL: "nomic-embed-text"
    });

    expect(env.PORT).toBe(4000);
    expect(env.SUPABASE_URL).toContain("supabase");
  });
});
