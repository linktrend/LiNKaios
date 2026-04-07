#!/usr/bin/env bash
# For every git repo directly under PROJECTS_ROOT (except Archive, Dev-Server,
# LiNKsmartfile, LiNKaios):
#   - If missing, full-clone known link-* URLs (see DEFAULT_CLONES).
#   - If shallow, git fetch --unshallow (full history = mirror remote).
#   - Run linktrend-skills/install.sh (Layer 1 + skills + AGENTS.md).
#   - Copy curated Layer 2 rules from scripts/workspace-layer2/<name>/.
#
# LiNKaios is skipped (already has full Layer 1–2 in-repo).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIOS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECTS_ROOT="${PROJECTS_ROOT:-$(cd "$LIOS_ROOT/.." && pwd)}"
LINKTREND_SKILLS_ROOT="${LINKTREND_SKILLS_ROOT:-$PROJECTS_ROOT/linktrend-skills}"
INSTALL_SH="$LINKTREND_SKILLS_ROOT/install.sh"

if [[ ! -f "$INSTALL_SH" ]]; then
  echo "ERROR: linktrend-skills installer not found at: $INSTALL_SH"
  exit 1
fi

clone_if_missing() {
  local name="$1"
  local url="$2"
  local target="$PROJECTS_ROOT/$name"
  if [[ -d "$target/.git" ]]; then
    echo "[ok] already cloned: $name"
    return 0
  fi
  echo "[clone] $url -> $target (full history)"
  git clone "$url" "$target"
}

ensure_full_history() {
  local target="$1"
  (
    cd "$target" || exit 0
    if git rev-parse --is-shallow-repository >/dev/null 2>&1 && [[ "$(git rev-parse --is-shallow-repository)" == "true" ]]; then
      echo "    [unshallow] $(basename "$target")"
      git fetch --unshallow 2>/dev/null || git fetch --depth=2147483647
    fi
  )
}

DEFAULT_CLONES=(
  "link-llm-council|https://github.com/linktrend/link-llm-council.git"
  "link-plane|https://github.com/linktrend/link-plane.git"
  "link-zulip|https://github.com/linktrend/link-zulip.git"
  "link-chatwoot|https://github.com/linktrend/link-chatwoot.git"
  "link-agency-agents|https://github.com/linktrend/link-agency-agents.git"
  "link-account-financial-tools|https://github.com/linktrend/link-account-financial-tools.git"
  "link-GlitchTip|https://github.com/linktrend/link-GlitchTip.git"
  "link-growthbook|https://github.com/linktrend/link-growthbook.git"
  "link-listmonk|https://github.com/linktrend/link-listmonk.git"
  "link-metabase|https://github.com/linktrend/link-metabase.git"
  "link-odoo|https://github.com/linktrend/link-odoo.git"
  "link-paperless-ngx|https://github.com/linktrend/link-paperless-ngx.git"
  "link-postiz-app|https://github.com/linktrend/link-postiz-app.git"
  "link-serpbear|https://github.com/linktrend/link-serpbear.git"
  "link-typebot.io|https://github.com/linktrend/link-typebot.io.git"
  "link-umami|https://github.com/linktrend/link-umami.git"
  "link-vaultwarden|https://github.com/linktrend/link-vaultwarden.git"
)

echo "=== LiNKtrend workspace bootstrap ==="
echo "PROJECTS_ROOT=$PROJECTS_ROOT"
echo ""

echo "==> Clone pass (full clone, missing dirs only)"
for entry in "${DEFAULT_CLONES[@]}" ${LINKTREND_CLONE_EXTRA:-}; do
  [[ -z "${entry// }" ]] && continue
  name="${entry%%|*}"
  url="${entry##*|}"
  clone_if_missing "$name" "$url"
done

echo ""
echo "==> Full history + Layer 1 install + Layer 2 copy"
for d in "$PROJECTS_ROOT"/*/; do
  [[ -d "$d" ]] || continue
  name="$(basename "$d")"
  case "$name" in Archive|Dev-Server|LiNKsmartfile|LiNKaios) continue ;; esac
  if [[ ! -d "$d.git" ]]; then
    if [[ "$name" == "linktrend-skills" ]] && [[ -f "$d/install.sh" ]]; then
      :
    else
      continue
    fi
  fi

  echo ""
  echo ">>> $name"
  if [[ -d "$d.git" ]]; then
    ensure_full_history "$d"
  fi
  echo "    install.sh"
  bash "$INSTALL_SH" "$d"
done

echo ""
bash "$SCRIPT_DIR/apply-workspace-layer2.sh"

echo ""
echo "=== Done ==="
echo "LiNKaios unchanged. To refresh LiNKaios Layer 1 only: bash \"$INSTALL_SH\" \"$LIOS_ROOT\" (then restore 10–15 from git if needed)."
