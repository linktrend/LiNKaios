import { readFileSync } from "node:fs";

export type IdentityMetadata = {
  dprId: string;
  tenantId: string;
};

function parseIdentityField(content: string, key: string): string | null {
  const pattern = new RegExp(`^${key}:\\s*"?([^"\\n]+)"?$`, "im");
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

export function parseIdentityMetadata(identityPath: string): IdentityMetadata {
  const content = readFileSync(identityPath, "utf8");

  const dprId =
    parseIdentityField(content, "dpr_id") || parseIdentityField(content, "DPR_ID") || null;
  const tenantId =
    parseIdentityField(content, "authorized_tenant_id") ||
    parseIdentityField(content, "AUTHORIZED_TENANT_ID") ||
    parseIdentityField(content, "tenant_id") ||
    parseIdentityField(content, "TENANT_ID") ||
    null;

  if (!dprId) {
    throw new Error(`IDENTITY.md missing dpr_id in ${identityPath}`);
  }

  if (!tenantId) {
    throw new Error(`IDENTITY.md missing authorized_tenant_id in ${identityPath}`);
  }

  return { dprId, tenantId };
}

export function parseIdentityTenant(identityPath: string): string {
  return parseIdentityMetadata(identityPath).tenantId;
}

export function parseIdentityDpr(identityPath: string): string {
  return parseIdentityMetadata(identityPath).dprId;
}
