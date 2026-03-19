# Git Strategy (Origin Source of Truth)

## Scope
This strategy applies to LiNKaios:
- Origin (authoritative): `https://github.com/linktrend/LiNKaios`

`origin` is the only writable remote and the single source of truth.

## Source-of-Truth Rules
1. All new work lands in `origin` through short-lived branches and merges to `main`.
2. Production and MVO acceptance runs are built only from commits present on `origin/main`.
3. Cross-repo integrations (LiNKpaperclip, LiNKskills, LiNKautowork, LiNKopenclaw, LiNKagentzero) must target canonical AIOS contracts, but LiNKaios remains authoritative for control-plane contract publication in this repo.
4. Persona and policy runtime artifacts are generated from LiNKbrain-backed revisions and are not authoritative when edited directly on agent filesystems.

## Remote Safety Controls
Required local configuration:

```bash
git remote set-url origin https://github.com/linktrend/LiNKaios.git
git config remote.pushDefault origin
git config branch.main.remote origin
git config branch.main.merge refs/heads/main
```

Verify:

```bash
git remote -v
```

Expected:
- `origin` fetch/push -> `https://github.com/linktrend/LiNKaios.git`

## Branching and Merge Model
- Trunk: `main`
- Working branches: short-lived only (`feat/*`, `fix/*`, `ops/*`, `mvo/*`, `sync/*`, `codex/*`)
- Normal operation: no direct pushes to `main`
- Merge policy: reviewed branch merges to `main`

## Release and Promotion
1. Merge validated changes to `main`.
2. Tag releases from `main` (`mvo-vX.Y.Z` or `release-vX.Y.Z`).
3. Deploy by tag or commit SHA to preserve auditability.

## Daily Operating Commands

Update local state:

```bash
git fetch origin --prune
git checkout main
git pull --ff-only origin main
```

Create feature branch:

```bash
git checkout -b feat/<short-name>
```

Push branch:

```bash
git push -u origin feat/<short-name>
```

Merge branch back into main locally (non-interactive):

```bash
git checkout main
git merge --no-ff feat/<short-name>
git push origin main
```

## Incident Safety
If remote configuration drifts, immediately re-apply:

```bash
git remote set-url origin https://github.com/linktrend/LiNKaios.git
git config remote.pushDefault origin
```

Then verify with:

```bash
git remote -v
```
