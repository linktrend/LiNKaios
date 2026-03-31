# Release Gate Checklist (LiNKaios)

- [ ] `main` is synchronized with origin and is deployment source.
- [ ] CI green: typecheck + tests + secret scan + dependency scan.
- [ ] Runtime env follows non-secret + `*_SECRET_NAME` contract.
- [ ] GSM secret access validated for all required keys.
- [ ] HTTPS/TLS and Tailscale ingress validated.
- [ ] Operator auth flow validated (Supabase session + MFA via gateway).
- [ ] Audit writes verified in LiNKbrain/Supabase.
- [ ] Kill-switch behavior verified.
- [ ] Backup/restore runbook rehearsal completed.
- [ ] Evidence artifact captured for release tag/SHA.
