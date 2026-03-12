#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LINKBOTS_DIR="$ROOT_DIR/linkbots"

mkdir -p "$LINKBOTS_DIR"

clone_or_update() {
  local name="$1"
  local url="$2"
  local target="$LINKBOTS_DIR/$name"

  if [[ -d "$target/.git" ]]; then
    echo "[update] $name"
    git -C "$target" fetch --all --tags --prune
    git -C "$target" pull --ff-only
  else
    echo "[clone] $name"
    git clone "$url" "$target"
  fi
}

clone_or_update "paperclip" "https://github.com/linktrend/link-paperclip"
clone_or_update "openclaw" "https://github.com/linktrend/link-openclaw"
clone_or_update "agent-zero" "https://github.com/linktrend/link-agent-zero"
clone_or_update "llm-council" "https://github.com/linktrend/link-llm-council"

echo "Upstream repositories are available under $LINKBOTS_DIR"
