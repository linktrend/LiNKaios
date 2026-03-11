export function requireTenantContext(tenantId: string | undefined): string {
  if (!tenantId) {
    throw new Error("Missing tenant context: app.current_tenant must be set");
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
