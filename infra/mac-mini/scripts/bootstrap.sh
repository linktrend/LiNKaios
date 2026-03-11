#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Run this script on macOS"
  exit 1
fi

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required"
  exit 1
fi

brew install ollama uv tailscale

if ! pgrep -f "ollama" >/dev/null 2>&1; then
  nohup ollama serve >/tmp/ollama.log 2>&1 &
fi

ollama pull nomic-embed-text
ollama pull deepseek-r1:8b

echo "Mac mini bootstrap complete. Configure firewall and restricted worker user next."
