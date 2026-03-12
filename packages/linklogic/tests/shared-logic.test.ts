import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertDprMatch,
  assertTenantMatch,
  buildRunId,
  GSMSecretProvider,
  parseIdentityDpr,
  parseIdentityMetadata,
  parseIdentityTenant,
  requireTenantContext,
  sha256Hex
} from "../src/index.js";

describe("linklogic", () => {
  it("builds deterministic run_id prefix", () => {
    const runId = buildRunId("run");
    expect(runId.startsWith("run_")).toBe(true);
  });

  it("validates tenant context UUID", () => {
    expect(() => requireTenantContext(undefined)).toThrow(/Missing tenant context/);
    expect(() => requireTenantContext("not-a-uuid")).toThrow(/Invalid tenant context/);
    expect(requireTenantContext("5bb916ec-8f53-4424-b9fa-9969f1ab384f")).toBe(
      "5bb916ec-8f53-4424-b9fa-9969f1ab384f"
    );
  });

  it("raises security exception on tenant mismatch", () => {
    expect(() =>
      assertTenantMatch(
        "5bb916ec-8f53-4424-b9fa-9969f1ab384f",
        "ae5836aa-1dfd-49eb-8ceb-d1f6bf94172a"
      )
    ).toThrow(/tenant mismatch/);
  });

  it("raises security exception on DPR mismatch", () => {
    expect(() => assertDprMatch("INT-MNG-260311-0001-LISA", "INT-MNG-260311-0002-ERIC")).toThrow(
      /dpr mismatch/
    );
  });

  it("parses TENANT_ID from identity file", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "identity-test-"));
    const identityPath = join(tempDir, "IDENTITY.md");
    writeFileSync(
      identityPath,
      'dpr_id: "INT-MNG-260311-0001-LISA"\nauthorized_tenant_id: "5bb916ec-8f53-4424-b9fa-9969f1ab384f"\n'
    );

    expect(parseIdentityTenant(identityPath)).toBe("5bb916ec-8f53-4424-b9fa-9969f1ab384f");
    expect(parseIdentityDpr(identityPath)).toBe("INT-MNG-260311-0001-LISA");
    expect(parseIdentityMetadata(identityPath)).toEqual({
      dprId: "INT-MNG-260311-0001-LISA",
      tenantId: "5bb916ec-8f53-4424-b9fa-9969f1ab384f"
    });
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("computes SHA-256 checksums", () => {
    expect(sha256Hex("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("prefers local env for MVO secret lookup", async () => {
    const provider = new GSMSecretProvider({
      projectId: "test-project",
      env: { LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE: "local-secret" },
      client: {
        accessSecretVersion: async () => [{ payload: { data: Buffer.from("gsm-secret") } }] as any
      }
    });

    await expect(provider.getSecret("LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE")).resolves.toBe(
      "local-secret"
    );
  });

  it("falls back to GSM latest version when env is missing", async () => {
    const provider = new GSMSecretProvider({
      projectId: "test-project",
      env: {},
      client: {
        accessSecretVersion: async ({ name }: { name: string }) => {
          expect(name).toContain("/versions/latest");
          return [{ payload: { data: Buffer.from("gsm-secret") } }] as any;
        }
      }
    });

    await expect(provider.getSecret("LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE")).resolves.toBe(
      "gsm-secret"
    );
  });
});
