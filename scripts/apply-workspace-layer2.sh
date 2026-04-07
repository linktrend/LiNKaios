#!/usr/bin/env bash
# Copy curated Layer 2 Cursor rules from LiNKaios into sibling repos under PROJECTS_ROOT.
# Skips: Archive/, Dev-Server/, LiNKsmartfile/, LiNKaios (source of these files).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIOS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECTS_ROOT="${PROJECTS_ROOT:-$(cd "$LIOS_ROOT/.." && pwd)}"
LAYER2_SRC="$SCRIPT_DIR/workspace-layer2"

if [[ ! -d "$LAYER2_SRC" ]]; then
  echo "ERROR: Missing $LAYER2_SRC"
  exit 1
fi

shopt -s nullglob
for src_dir in "$LAYER2_SRC"/*/; do
  name="$(basename "$src_dir")"
  case "$name" in Archive|Dev-Server|LiNKsmartfile|LiNKaios) continue ;; esac
  dest="$PROJECTS_ROOT/$name/.cursor/rules"
  if [[ ! -d "$PROJECTS_ROOT/$name" ]]; then
    echo "[skip] missing: $name"
    continue
  fi
  if [[ ! -d "$PROJECTS_ROOT/$name/.git" ]] && [[ "$name" != "linktrend-skills" ]]; then
    echo "[skip] not a git repo: $name"
    continue
  fi
  echo "==> Layer 2 rules: $name"
  mkdir -p "$dest"
  for f in "$src_dir"/*.mdc; do
    cp -f "$f" "$dest/"
    echo "    $(basename "$f")"
  done
done

echo "=== Layer 2 apply complete ==="
