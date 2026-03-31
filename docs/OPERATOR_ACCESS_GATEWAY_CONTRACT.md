# Operator Access Gateway Contract

## Required behavior
- Reverse proxy is the only public/operator entrypoint.
- Supabase-authenticated session is required prior to backend forwarding.
- MFA-enforced access policy must be active for operator accounts.
- Backend services (Paperclip, LiNKaios) stay on internal network only.

## Header/identity propagation
- Gateway should forward authenticated identity headers to upstream when needed.
- Upstream should not trust unauthenticated direct traffic.

## Deny conditions
- Missing/invalid auth session.
- Missing MFA claim when policy requires MFA.
- Access from non-authorized network path when firewall/Tailscale policy disallows ingress.
