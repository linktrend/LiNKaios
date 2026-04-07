#!/usr/bin/env bash
# Open (or show) a PR from staging to main. Conflicts are resolved on GitHub or via a follow-up dev branch — never force-push protected branches.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

command -v gh >/dev/null 2>&1 || {
  echo "gh CLI not found. Install: https://cli.github.com/"
  exit 1
}

git fetch origin staging main 2>/dev/null || git fetch origin

open_count="$(gh pr list --base main --head staging --json number --jq 'length')"
if [[ "${open_count:-0}" -gt 0 ]]; then
  echo "Existing PR(s) staging → main:"
  gh pr list --base main --head staging
  exit 0
fi

gh pr create \
  --base main \
  --head staging \
  --title "chore(git): promote staging → main" \
  --body "## SOP v2 — staging → main

- Source: \`staging\`
- Target: \`main\`

**Before merge**
- [ ] Integration verified on \`staging\`
- [ ] Conflicts resolved (GitHub UI or approved merge strategy)
- [ ] CI green
- [ ] Min. 1 approval per branch protection

Deploy only from \`main\` per release runbooks."

echo "Done."
