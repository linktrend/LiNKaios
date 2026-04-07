# Unified Dev Test Runbook (LiNKaios + LiNKskills + LiNKautowork + Paperclip/OpenClaw/AgentZero)

Owner: LiNKtrend Platform  
Last updated: 2026-04-01

Last updated: 2026-03-19

## Goal

Run one integrated dev topology with canonical `aios.*` transport, strict LiNKskills contract, and GSM-managed secrets only.

## Repository Paths

- LiNKaios: `/Users/linktrend/Projects/LiNKaios`
- LiNKskills: `/Users/linktrend/Projects/LiNKskills`
- LiNKautowork: `/Users/linktrend/Projects/LiNKautowork`
- LiNKpaperclip: `/Users/linktrend/Projects/LiNKpaperclip` (fork: `link-paperclip`)
- LiNKopenclaw: `/Users/linktrend/Projects/LiNKopenclaw` (fork: `link-openclaw`)
- LiNKagentzero: `/Users/linktrend/Projects/LiNKagentzero` (fork: `link-agent-zero`)
- link-antigravity-kit: `/Users/linktrend/Projects/link-antigravity-kit` (canonical folder name for `github.com/linktrend/link-antigravity-kit`)
- link-awesome-openclaw-skills: `/Users/linktrend/Projects/link-awesome-openclaw-skills` (`github.com/linktrend/link-awesome-openclaw-skills`)

### One-shot: full clones + Layer 1 skills + curated Layer 2

From LiNKaios, with `linktrend-skills` in the same parent folder as other repos:

```bash
./scripts/bootstrap-linktrend-workspace-repos.sh
```

This **fully clones** (no `--depth`) any listed `link-*` repo that is missing (including infra/product forks such as `link-metabase`, `link-odoo`, `link-vaultwarden`, `link-umami`, `link-typebot.io`, `link-GlitchTip`, and the rest in `DEFAULT_CLONES` inside the script), **unshallows** shallow repos so local history matches the remote, runs `linktrend-skills/install.sh` on **every** sibling git repo except `Archive/`, `Dev-Server/`, `LiNKsmartfile/`, and `LiNKaios`, then copies **curated Layer 2** rules from `scripts/workspace-layer2/<repo>/` into each repo’s `.cursor/rules/`. `linktrend-skills` itself is included when present. LiNKaios is left unchanged.

## Preconditions

1. ADC/service-account auth is active for GSM reads.
2. Required `*_SECRET_NAME` values are configured in:
   - LiNKaios `.env` (non-secret values + secret names only)
   - LiNKautowork `deploy/dev/.env` (non-secret values + secret names only)
3. Canonical tenant ID remains `00000000-0000-0000-0000-000000000001`.

## Startup Order

1. Render LiNKautowork runtime env from GSM:

```bash
cd /Users/linktrend/Projects/LiNKautowork
ops/render-env-from-gsm.sh dev
```

2. Start LiNKautowork dev stack (NATS + gateway + n8n):

```bash
docker compose --env-file deploy/dev/.env.runtime -f deploy/dev/docker-compose.yml up -d --build
```

3. Start LiNKskills API on `8081` (avoid `8080` collision with LiNKautowork gateway):

```bash
cd /Users/linktrend/Projects/LiNKskills
export LOGIC_ENGINE_PORT=8081
python3 services/logic-engine/scripts/run_api.py
```

4. Start LiNKaios control plane (ensure `LINKSKILLS_API_URL=http://localhost:8081` in LiNKaios `.env`):

```bash
cd /Users/linktrend/Projects/LiNKaios
pnpm --filter @linktrend/LiNKaios dev
```

5. Bootstrap Paperclip canonical JetStream stream/consumers:

```bash
cd /Users/linktrend/Projects/LiNKpaperclip/server
pnpm nats:bootstrap
```

6. Start OpenClaw management consumer:

```bash
cd /Users/linktrend/Projects/LiNKopenclaw
pnpm aios:nats:consumer
```

7. Start AgentZero execution worker:

```bash
cd /Users/linktrend/Projects/LiNKagentzero
python3 -m python.helpers.aios_nats_worker
```

8. Run integrated readiness + evidence harness:

```bash
cd /Users/linktrend/Projects/LiNKaios
./scripts/unified-dev-check.sh
```

Static-only mode (without live services):

```bash
SKIP_NATS_BOOTSTRAP=1 SKIP_RUNTIME_HEALTH=1 SKIP_PREDEPLOY_HARNESS=1 ./scripts/unified-dev-check.sh
```

## Health Gates

The topology is considered dev-test ready only when all pass:

1. `curl -fsS http://localhost:8080/health` (LiNKautowork gateway)
2. `curl -fsS http://localhost:8081/v1/ops/safe-mode` (LiNKskills API)
3. `curl -fsS http://localhost:4000/health` (LiNKaios)
4. `pnpm --dir /Users/linktrend/Projects/LiNKpaperclip/server nats:bootstrap` exits `0`
5. `./scripts/mvo-predeploy-acceptance.sh` exits `0`

## Evidence Output

Unified evidence bundle is written to:

- `/Users/linktrend/Projects/LiNKaios/artifacts/unified-dev/<timestamp>/`

Includes:

1. Health snapshots from LiNKaios, LiNKskills, LiNKautowork.
2. Copied latest AIOS predeployment evidence artifact.
3. Cross-repo git revision manifest.
4. Unified execution summary markdown.

## Stop Order

1. Stop AgentZero worker (Ctrl+C).
2. Stop OpenClaw consumer (Ctrl+C).
3. Stop LiNKaios (Ctrl+C).
4. Stop LiNKskills (Ctrl+C).
5. Stop LiNKautowork stack:

```bash
cd /Users/linktrend/Projects/LiNKautowork
docker compose --env-file deploy/dev/.env.runtime -f deploy/dev/docker-compose.yml down
```
