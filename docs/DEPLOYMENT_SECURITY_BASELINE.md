# Deployment Security Baseline (MVO)

## Mandatory controls
1. Secrets only in GSM; runtime loads via secret names.
2. HTTPS/TLS for all operator and service endpoints.
3. Tailscale private access as primary ingress.
4. IP allowlist as secondary perimeter control.
5. Authenticated operator UI with MFA.
6. Audit logs retained and queryable.
7. Kill-switch controls verified.
8. Backup + restore drills executed and recorded.

## Negative gates
- Startup must fail when required secret resolution fails.
- Direct public access to internal services must be blocked.
- Deploys from non-main/master refs are disallowed.
