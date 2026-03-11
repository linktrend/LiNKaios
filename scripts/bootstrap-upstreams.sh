#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="$ROOT_DIR/vendor"

mkdir -p "$VENDOR_DIR"

clone_or_update() {
  local name="$1"
  local url="$2"
  local target="$VENDOR_DIR/$name"

  if [[ -d "$target/.git" ]]; then
    echo "[update] $name"
    git -C "$target" fetch --all --tags --prune
    git -C "$target" pull --ff-only
  else
    echo "[clone] $name"
    git clone "$url" "$target"
  fi
}

clone_or_update "paperclip" "https://github.com/paperclipai/paperclip"
clone_or_update "openclaw" "https://github.com/openclaw/openclaw"
clone_or_update "agent-zero" "https://github.com/agent0ai/agent-zero"
clone_or_update "llm-council" "https://github.com/karpathy/llm-council"

echo "Upstream repositories are available under $VENDOR_DIR"
