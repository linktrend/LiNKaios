# Git promotion & deploy helpers

LiNKtrend **SOP v2** forbids direct pushes to `staging` and `main`. Use **pull requests** and branch protection.

| Script | Purpose |
|--------|---------|
| `create-pr-to-staging.sh` | From `dev/*`: push and open PR → `staging` (`gh` required). |
| `create-pr-staging-to-main.sh` | Open PR `staging` → `main` if none exists. |
| `print-deploy-main-checklist.sh` | Echo deploy checklist (no remote actions). |

**Prerequisites:** `gh auth login`, repo `origin` on GitHub, clean working tree for PR scripts.

Cursor slash commands in `.cursor/commands/` instruct the agent to use these with your approval.
