#!/usr/bin/env bash
# Clone missing active LiNKtrend repos under PROJECTS_ROOT, run Layer 1 skills install,
# and add a minimal Layer 2 stub (10-foundation.mdc) when none exists.
#
# Usage:
#   ./scripts/bootstrap-linktrend-workspace-repos.sh
#   PROJECTS_ROOT=/path/to/parent LINKTREND_SKILLS_ROOT=/path/to/linktrend-skills ./scripts/bootstrap-linktrend-workspace-repos.sh
#
# LiNKaios is skipped for bulk install (it already carries full Layer 1 + custom Layer 2).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIOS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECTS_ROOT="${PROJECTS_ROOT:-$(cd "$LIOS_ROOT/.." && pwd)}"
LINKTREND_SKILLS_ROOT="${LINKTREND_SKILLS_ROOT:-$PROJECTS_ROOT/linktrend-skills}"
INSTALL_SH="$LINKTREND_SKILLS_ROOT/install.sh"
STUB_TEMPLATE="$SCRIPT_DIR/templates/layer2-stub-foundation.mdc"

if [[ ! -f "$INSTALL_SH" ]]; then
  echo "ERROR: linktrend-skills installer not found at: $INSTALL_SH"
  echo "Clone the skills distribution repo or set LINKTREND_SKILLS_ROOT."
  exit 1
fi

if [[ ! -f "$STUB_TEMPLATE" ]]; then
  echo "ERROR: Missing stub template: $STUB_TEMPLATE"
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
  echo "[clone] $url -> $target"
  git clone --depth 1 "$url" "$target"
}

# Active forks / services commonly used alongside LiNKaios (not Zepricated; not deprecated papercups / Dev-Tasks).
# Extend with LINKTREND_CLONE_EXTRA="name|url name|url" if needed.
DEFAULT_CLONES=(
  "link-llm-council|https://github.com/linktrend/link-llm-council.git"
  "link-plane|https://github.com/linktrend/link-plane.git"
  "link-zulip|https://github.com/linktrend/link-zulip.git"
  "link-chatwoot|https://github.com/linktrend/link-chatwoot.git"
  "link-agency-agents|https://github.com/linktrend/link-agency-agents.git"
)

echo "=== LiNKtrend workspace bootstrap ==="
echo "PROJECTS_ROOT=$PROJECTS_ROOT"
echo "LINKTREND_SKILLS_ROOT=$LINKTREND_SKILLS_ROOT"
echo ""

echo "==> Clone pass (missing dirs only)"
for entry in "${DEFAULT_CLONES[@]}" ${LINKTREND_CLONE_EXTRA:-}; do
  [[ -z "${entry// }" ]] && continue
  name="${entry%%|*}"
  url="${entry##*|}"
  clone_if_missing "$name" "$url"
done

# Sibling repos that should receive Layer 1 + stub Layer 2 (existing folders).
# LiNK* cores use historical directory names; remotes are github.com/linktrend/<same>.
INSTALL_REPOS=(
  LiNKskills
  LiNKautowork
  LiNKapps
  LiNKsites
  LiNKsmartfile
  LiNKpaperclip
  LiNKopenclaw
  LiNKagentzero
  link-antigravity-kit
  link-awesome-openclaw-skills
  link-llm-council
  link-plane
  link-zulip
  link-chatwoot
  link-agency-agents
)

install_layer1_and_stub_layer2() {
  local name="$1"
  local target="$PROJECTS_ROOT/$name"
  if [[ ! -d "$target" ]]; then
    echo "[skip] missing directory: $name"
    return 0
  fi
  echo ""
  echo "==> Layer 1 install: $name"
  bash "$INSTALL_SH" "$target"

  local foundation="$target/.cursor/rules/10-foundation.mdc"
  if [[ ! -f "$foundation" ]]; then
    echo "    + Layer 2 stub: 10-foundation.mdc"
    mkdir -p "$target/.cursor/rules"
    sed "s/__REPO_DISPLAY_NAME__/$name/g" "$STUB_TEMPLATE" >"$foundation"
  else
    echo "    (keep existing 10-foundation.mdc)"
  fi
}

echo ""
echo "==> Layer 1 + Layer 2 stub pass"
for name in "${INSTALL_REPOS[@]}"; do
  install_layer1_and_stub_layer2 "$name"
done

echo ""
echo "=== Done ==="
echo "LiNKaios was not modified by this script (it already has curated Layer 1–2)."
echo "To refresh LiNKaios Layer 1 only, run: bash \"$INSTALL_SH\" \"$LIOS_ROOT\""
echo "Then restore any customized .cursor/rules/10–15 and AGENTS.md from git if needed."
