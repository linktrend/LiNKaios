export function requireTenantContext(tenantId: string | undefined): string {
  if (!tenantId) {
    throw new Error("Missing tenant context: app.current_tenant must be set");
  }

  // Accept canonical UUID formatting, including the all-zero internal tenant UUID.
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(tenantId)) {
    throw new Error("Invalid tenant context: app.current_tenant must be a UUID");
  }

  return tenantId;
}

export function assertTenantMatch(payloadTenantId: string, identityTenantId: string): void {
  if (payloadTenantId !== identityTenantId) {
    throw new Error(
      `Security exception: tenant mismatch payload=${payloadTenantId} identity=${identityTenantId}`
    );
  }
}

export function assertDprMatch(payloadDprId: string, identityDprId: string): void {
  if (payloadDprId !== identityDprId) {
    throw new Error(`Security exception: dpr mismatch payload=${payloadDprId} identity=${identityDprId}`);
  }
}
