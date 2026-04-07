# Promote dev branch → staging (PR)

Use this when work on `dev/<machine><ide>` is ready for integration.

## Rules

- Follow `.cursor/rules/01-git-branching.mdc`: **no direct push to `staging`**.
- Conventional commits: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `ci`.

## Steps

1. Confirm the current branch matches `dev/*` (not `main` or `staging`).
2. If there are uncommitted changes, help the user craft a **single focused** conventional commit (or ask them to split commits). Do not commit secrets.
3. When the tree is clean, run from repo root:

   ```bash
   ./scripts/workflow/create-pr-to-staging.sh
   ```

4. Paste the PR URL GitHub returns. Remind: **CI must pass** and **approval** is required before merge.

## If the script refuses

- **Not on `dev/*`:** create/checkout the correct `dev/<machine><ide>` branch first.
- **Dirty tree:** stage and commit, or stash.
- **`gh` errors:** run `gh auth status` and ensure `origin` is the GitHub repo.
