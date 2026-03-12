import { describe, expect, it } from "vitest";
import { loadLiNKautoworkEnv } from "./env.js";

describe("LiNKautowork env", () => {
  it("prefers MVO fallback env values", async () => {
    const loaded = await loadLiNKautoworkEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE: "sb_secret_example_1234567890",
        LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN: "pm_server_token_1234567890",
        LINKTREND_AIOS_PROD_OPENROUTER_API_KEY: "openrouter_key_1234567890"
      },
      {
        getSecret: async (_secretName, options) => {
          if (options?.fallbackEnvVar) {
            return options.env?.[options.fallbackEnvVar] ?? "";
          }
          return "";
        }
      }
    );

    expect(loaded.SUPABASE_SERVICE_ROLE_KEY).toContain("sb_secret");
    expect(loaded.POSTMARK_SERVER_TOKEN).toContain("pm_server");
    expect(loaded.OPENROUTER_API_KEY).toContain("openrouter");
  });
});
