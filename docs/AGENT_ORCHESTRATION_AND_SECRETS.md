# Agent orchestration & secret access (setup phase)

Owner: LiNKtrend Platform  
Last updated: 2026-04-07

## Macro vs per-repo agents (Cursor / IDE)

- **Macro agent:** One conversation anchored in **LiNKaios** (AIOS control plane) owns **strategy, sequencing, and cross-repo integration**. It uses runbooks, `docs/handoffs/`, and repo paths under the same machine as the source of truth for “what happens next.”
- **Execution agents:** Separate Cursor windows (or sessions) per **sibling repo** do deep implementation, tests, and lint in that codebase only.
- **Runtime orchestration:** Real scheduling and automation live in **LiNKaios / Paperclip / LiNKautowork / NATS**, not in the IDE. IDE agents plan and edit; the product runs missions.

**Continuity:** After each focused session, write a handoff under `docs/handoffs/` (see `.cursor/rules/07-cross-ide-handoff.mdc`). The macro agent reads it before continuing.

## Secrets: GSM first (not Cursor-only)

- **Authoritative store:** Google Secret Manager (GSM). See [Secret Management](./SECRET_MANAGEMENT.md) for naming (`LINKTREND_*`) and runtime contract.
- **Cross-machine:** Prefer **GSM + service account** over Cursor-specific secret stores so any machine with ADC can run the same scripts.

### What humans (and agents via terminal) need to read GSM

1. **`GOOGLE_CLOUD_PROJECT`** or **`GCP_PROJECT`** — target GCP project where secrets live.  
2. **`GOOGLE_APPLICATION_CREDENTIALS`** — path to a **service account JSON key file** on disk (gitignored; often under `secrets/`).  
3. The service account must have **`roles/secretmanager.secretAccessor`** (and any other roles your scripts require) on that project.

**LiNKaios code path:** Apps use the `GSMSecretProvider` in `packages/linklogic` as documented in `SECRET_MANAGEMENT.md`.

**IDE agents:** Cursor does not automatically “have GSM.” Agents use **terminal + your tooling** (e.g. `gcloud secrets versions access`, or repo `ops/render-env-from-gsm.sh`-style scripts) **after** `gcloud auth application-default login` **or** with `GOOGLE_APPLICATION_CREDENTIALS` set for a dedicated SA.

### CLI / SDK preference vs MCP

- **Default:** **CLI and official SDKs** (`gh`, Supabase CLI, `doctl`, `gcloud`) with env injected from GSM render scripts—fewer surprise context pulls than broad MCP servers.  
- **MCP:** Add only where it clearly beats CLI for a **narrow** workflow; avoid loading large schema dumps into chat by default.  
- **After v1 launch:** Narrow or remove broad credentials, disable optional MCP servers, and tighten IAM to least privilege.

## Related

- [Unified Dev Test Runbook](./UNIFIED_DEV_TEST_RUNBOOK.md) — workspace bootstrap (`scripts/bootstrap-linktrend-workspace-repos.sh`)  
- [Secret Management](./SECRET_MANAGEMENT.md) — GSM naming and runtime contract
