#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not a git repository; cannot initialize submodules."
  exit 1
fi

echo "[submodule] git submodule update --init --recursive"
git submodule update --init --recursive

echo "Upstream applets are available under $ROOT_DIR/applets/"
