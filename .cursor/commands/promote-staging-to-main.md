# Promote staging → main (PR + conflict strategy)

Use after `staging` has absorbed dev work and you are ready for production-bound integration.

## Rules

- **No direct push to `main` or `staging`.** Resolve work only through PRs and branch protection.
- Conflicts on `staging` → `main` are normal when `main` has moved: resolve using **GitHub’s PR conflict UI** or an **intermediate fix branch** from `dev/*` that merges latest `staging`/`main` as policy allows — never force-push protected branches.

## Steps

1. Fetch remotes and inspect open PRs:

   ```bash
   git fetch origin
   gh pr list --base main --head staging
   ```

2. If a PR **already exists**, guide the user through **checks, reviews, and conflict resolution** in the GitHub UI until mergeable.

3. If **no** PR exists, open one:

   ```bash
   ./scripts/workflow/create-pr-staging-to-main.sh
   ```

4. After merge to `main` is approved, remind: **deploy only from `main`** per `.cursor/rules/15-release-deploy.mdc` and runbooks — use `/deploy-from-main` for the checklist.

## Conflict handling (plain English)

- Prefer resolving on the **GitHub PR page** so audit trail stays clear.
- If policy requires a new dev branch to carry fixes, branch from the latest `staging`, merge `main` (or rebase per team convention), fix, PR → `staging`, then repeat promotion toward `main` as needed.
