---
project: AURION
document: GitHub Repository Tool
folder: 26_PROJECT_MANAGEMENT
owner: Daniel Gonzalez Junco
status: active
created_at: 2026-05-31
---

# GitHub Repository Tool

This document explains the local tool that creates a GitHub repository before we promote it to a plugin or MCP tool.

## Quick path

1. Create a GitHub token with repository creation permission.
2. Set it locally as `GITHUB_TOKEN` or `GH_TOKEN`.
3. Run the tool in dry-run mode first.
4. Run with `--execute --set-origin` only after reviewing the payload.

## Commands

```powershell
# Dry run: safe, no network write
python tools/github/create_repo.py AURION

# Real creation under the authenticated GitHub user
$env:GITHUB_TOKEN="ghp_your_token_here"
python tools/github/create_repo.py AURION --execute --set-origin
```

## Safety rules

- Never commit the token.
- Default repository visibility is private.
- The tool does not call GitHub unless `--execute` is provided.
- Tests mock behavior and do not create real repositories.

## Verification

```powershell
python -m unittest tests.tools.test_create_github_repo
```

