#!/usr/bin/env bash
# Open a PR from the current dev/* branch to staging (SOP v2). Requires: gh, git, clean tree, pushed branch.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

command -v gh >/dev/null 2>&1 || {
  echo "gh CLI not found. Install: https://cli.github.com/"
  exit 1
}

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ ! "$branch" =~ ^dev/ ]]; then
  echo "Refusing: current branch must be dev/<machine><ide> (see .cursor/rules/01-git-branching.mdc). On: $branch"
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash before opening the PR."
  git status -sb
  exit 1
fi

if ! git rev-parse "@{u}" >/dev/null 2>&1; then
  echo "No upstream set. Pushing: git push -u origin $branch"
  git push -u origin "$branch"
else
  echo "Pushing latest commits..."
  git push origin "$branch"
fi

count="$(gh pr list --base staging --head "$branch" --json number --jq 'length')"
if [[ "${count:-0}" -gt 0 ]]; then
  echo "A PR from $branch to staging already exists:"
  gh pr list --base staging --head "$branch"
  exit 0
fi

gh pr create \
  --base staging \
  --head "$branch" \
  --title "chore(git): promote ${branch} → staging" \
  --body "## SOP v2 — dev → staging

- Source branch: \`${branch}\`
- Target: \`staging\`

**Before merge**
- [ ] CI green
- [ ] Review complete (min. 1 approval per branch protection)

Do not push directly to \`staging\`."

echo "Done."
