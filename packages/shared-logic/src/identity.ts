import { readFileSync } from "node:fs";

export function parseIdentityTenant(identityPath: string): string {
  const content = readFileSync(identityPath, "utf8");
  const match = content.match(/^TENANT_ID:\s*([0-9a-f-]{36})$/im);

  if (!match) {
    throw new Error(`IDENTITY.md missing TENANT_ID in ${identityPath}`);
  }

  return match[1];
}
