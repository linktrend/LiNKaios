# Source-of-Truth Release Discipline

- `origin/main` is the authoritative deployment branch.
- Deploy only by immutable tag or commit SHA from `main`.
- Emergency fixes must still land through `main` and be tagged.
- Runtime artifacts and secrets are not source of truth in git.
- Every deploy must leave an immutable evidence record (commit SHA, image digest, runbook result).
