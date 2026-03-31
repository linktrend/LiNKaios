# AIOS Deployment Action Plan (Phase 1 Completion + Phase 2 Execution)

Last updated: 2026-03-12
Scope: Complete MVO (Phase 1) deployment and define executable Phase 2 plan.

## 1) Objective

- **Phase 1 target (MVO):** deliver a production-ready, secure, auditable autonomous operating stack on Debian VPS + Mac mini with Supabase as LiNKbrain and n8n as event/storage automation.
- **Phase 2 target (Full AIOS):** scale to resilient multi-venture autonomous operations with advanced strategy, budget autonomy, self-healing, and enterprise-grade security.

## 2) Current baseline summary

What is already in place:

- Turborepo monorepo structure and package split is in place.
- LiNKaios/LiNKautowork app skeletons are working locally.
- DPR V3 agent topology under `agents/internal/*` is present.
- Canonical GSM naming pattern integrated into code paths.
- Security improvements applied to mission ingress (auth + tenant/DPR checks + server-side identity resolution).
- LiNKboard integration points exist in LiNKaios.
- Workstream 9 audit traces were demonstrated in live Supabase using a non-canonical tenant UUID.

What still blocks true MVO completion:

- Live DB must contain fixed internal tenant ID `00000000-0000-0000-0000-000000000001`.
- Migration script must be re-verified/fixed for SQL correctness before future rollout.
- GSM payloads for OpenRouter/Postmark/Anthropic must be real production values (not placeholders).
- Full mission flow must be rerun on canonical tenant ID and archived as final acceptance evidence.

## 3) Phase 1 (MVO) completion plan

## 3.1 Workstream A - Database finalization (LiNKbrain)

Goal: ensure live Supabase exactly matches the intended contract.

Actions:

1. Verify `packages/linkbrain/migrations/0001_init.sql` compiles cleanly (no insert column/value mismatch).
2. Apply migration in live Supabase SQL editor (or psql), then refresh API schema cache if needed.
3. Ensure canonical internal tenant row exists:
   - `id = 00000000-0000-0000-0000-000000000001`
   - `slug = aios-internal`
4. Confirm RPCs callable by service role:
   - `public.bootstrap_tenant`
   - `public.upsert_mission` (tenant-aware)
   - `public.log_audit_run` (tenant-aware)
   - `public.list_audit_runs`
5. Verify RLS and direct-table lockouts remain effective on tenant-scoped tables.

Exit criteria:

- Canonical tenant exists.
- Mission + audit RPC calls succeed for canonical tenant.
- Cross-tenant attempts fail.

## 3.2 Workstream B - Secrets and runtime auth (GSM)

Goal: production secret retrieval from GSM works consistently on deployment hosts.

Actions:

1. Ensure service account used by LiNKaios/LiNKautowork has `roles/secretmanager.secretAccessor`.
2. Populate real payload versions for:
   - `LINKTREND_AIOS_PROD_SUPABASE_SERVICE_ROLE`
   - `LINKTREND_AIOS_PROD_OPENROUTER_API_KEY`
   - `LINKTREND_AIOS_PROD_POSTMARK_SERVER_TOKEN`
   - `LINKTREND_AIOS_PROD_ANTHROPIC_API_KEY`
3. Ensure runtime env is set on host:
   - `GOOGLE_CLOUD_PROJECT` or `GCP_PROJECT`
   - `GOOGLE_APPLICATION_CREDENTIALS`
4. Remove all placeholder local secret values from deployment `.env` (except explicitly-approved fallback cases).

Exit criteria:

- `loadEnv()` resolves all required secrets directly from GSM on target host.
- Secret rotation test (new version) is reflected without code change.

## 3.3 Workstream C - Control plane runtime deployment

Goal: stable services on Debian VPS with secure ingress.

Actions:

1. Deploy with `infra/debian-vps/docker-compose.yml`.
2. Confirm service health:
   - LiNKaios `/health`
   - n8n UI/API reachable on secured path
3. Enforce network posture:
   - UFW only necessary ports
   - Tailscale/allowlist ingress for private controls
   - TLS termination path in front of public endpoints
4. Validate ingress token requirement for all POST routes in LiNKaios.

Exit criteria:

- Services healthy after restart.
- Unauthorized requests are rejected.
- Minimal exposed surface.

## 3.4 Workstream D - Agent readiness and operations

Goal: all internal personas are deployment-ready.

Actions:

1. Validate each `IDENTITY.md` has correct role/department/channels/permissions.
2. Validate manager and worker `soul.md` + `memory.md` presence.
3. Validate worker runtime (`uv`) in `agents/internal/workers`.
4. Confirm channels:
   - Slack/webhook flow via n8n
   - Email notifications via Postmark
5. Confirm policy for tenant mismatch halt + alert is documented and tested.

Exit criteria:

- All internal agents discoverable.
- All required persona metadata present and consistent.

## 3.5 Workstream E - Hot/cold lifecycle automation

Goal: cost-control archival behavior functions correctly.

Actions:

1. Import and enable n8n workflows from `apps/LiNKautowork/workflows`.
2. Configure Supabase + Google Drive + Postmark credentials in n8n.
3. Verify 30-day inactivity trigger and `handover_pending` trigger.
4. Verify checksum validation before deleting hot object.
5. Ensure metadata pointer persistence after archive.
6. Validate manual restore workflow requires CEO/CTO authority.

Exit criteria:

- End-to-end archive and restore path tested with audit trail.

## 3.6 Workstream F - Workstream 9 final acceptance rerun

Goal: close Phase 1 with canonical acceptance evidence.

Actions:

1. Trigger mission using canonical context:
   - `tenant_id = 00000000-0000-0000-0000-000000000001`
   - `run_id = LT-ALPHA-001` (or a new approved run ID)
   - `dpr_id = INT-MNG-260311-0001-LISA`
2. Capture both success and security exception paths.
3. Query and export audit evidence from `lb_shared.audit_runs` (via RPC or SQL).
4. Produce acceptance artifact containing:
   - mission payload
   - status transitions
   - tenant/DPR gate results
   - token/cost telemetry

Exit criteria:

- Chairman flow accepted.
- Audit lineage complete and reproducible.

## 3.7 Phase 1 done definition

Phase 1 is complete when all are true:

- `./scripts/mvo-validate.sh` passes.
- Live canonical tenant is active and used.
- GSM supplies real secrets in production.
- End-to-end mission run is successful and auditable.
- Security gates are proven with both pass/fail cases.
- Storage lifecycle automation is validated.

## 4) Phase 2 execution plan

## 4.1 Phase 2 scope lock

Phase 2 includes:

1. LiNKboard in active strategic decision loop (not optional).
2. Cloudflare Logic Gateway/VPN hardening extensions.
3. Automated Daily Brief synthesis from run telemetry.
4. Venture kill-switch and spend runaway controls.
5. Autonomous budget rebalancing across ventures.
6. Self-healing workflows for services/containers/nodes.
7. Secret handling evolution from host `.env` fallback to strict vault-first mode.

## 4.2 Phase 2 workstreams

### Workstream P2-A: Strategic intelligence layer

- Expand LiNKboard from optional call to required structured deliberation stage.
- Define strategy prompt templates and decision schemas.
- Persist strategic outputs to `lb_shared.proposals` and mission metadata.

### Workstream P2-B: Reliability + self-healing

- Add watchdogs for LiNKaios, LiNKautowork, upstream gateways.
- Implement restart/reconcile policies.
- Add health-based automatic recovery actions with bounded retries.

### Workstream P2-C: Budget autonomy

- Add venture-level budget telemetry model.
- Implement policy-driven reallocation logic and approval gates.
- Add hard-stop rules and escalation notifications.

### Workstream P2-D: Security maturity

- Remove default local secret fallback in production mode.
- Add signed webhook verification and stricter authN/authZ.
- Add central SIEM-ready log export and anomaly alerting.

### Workstream P2-E: Multi-venture scaling

- Operationalize `venture_{name}` schema strategy.
- Add tenant provisioning automation and lifecycle governance.
- Add cross-venture routing controls and isolation tests.

## 4.3 Phase 2 acceptance criteria

- Required strategic deliberation occurs for designated decisions.
- Automatic healing handles defined fault classes without manual intervention.
- Budget controls prevent cap violations and produce auditable reallocations.
- Security controls pass penetration and misuse scenarios.
- Multi-venture onboarding is automated and isolated by design.

## 5) Execution order recommendation

1. Finish remaining Phase 1 blockers first.
2. Freeze a clean deployment tag for Phase 1.
3. Start Phase 2 with strategic layer and reliability foundations.
4. Add budget autonomy and multi-venture scaling after reliability baseline is stable.

## 6) Practical operator checklist

For the next operator/Codex instance, run in this order:

1. `pnpm install`
2. `pnpm test`
3. `./scripts/mvo-validate.sh`
4. Verify GSM secrets/versions/permissions in GCP.
5. Verify canonical tenant row in Supabase.
6. Run final Workstream 9 acceptance on canonical tenant ID.
7. Archive evidence in docs and/or `lb_shared.audit_runs` references.

## 7) Reporting template for completion

For each completion report, include:

- Environment (local/VPS/mac-mini)
- Run ID
- Tenant ID
- DPR ID(s)
- Changed files
- Validation command outputs
- Security checks run
- Outstanding risks (if any)

