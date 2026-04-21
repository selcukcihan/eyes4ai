---
title: Installation
description: How to install eyes4ai globally or per-repo.
---

eyes4ai runs via `npx` — no global install required.

## Global install (recommended)

Configures all your repos at once. Run this once:

```bash
npx @eyes4ai/cli install --global
```

This does four things:

1. Writes Codex OTel config to `~/.codex/config.toml`
2. Writes Claude Code OTel config to `~/.claude/settings.json`
3. Installs a global Git post-commit hook via `core.hooksPath`
4. Starts the OTel ingestion server as a background daemon (auto-starts on boot)

Every repo you work in will now record AI activity and commit correlations automatically. The server runs in the background — you never have to start it manually.

:::note
The global Git hook chains to any existing repo-local `.git/hooks/post-commit`, so your existing hooks keep working.
:::

## Per-repo install

If you prefer to enable eyes4ai for specific repos only:

```bash
cd /path/to/your/repo
npx @eyes4ai/cli install
```

This writes config files into the repo's `.codex/`, `.claude/`, and `.git/hooks/` directories.

## Custom port

The OTel ingestion server defaults to port 4318. To use a different port:

```bash
npx @eyes4ai/cli install --global 4319
```

## What gets created

| File | Purpose |
|------|---------|
| `~/.codex/config.toml` (global) or `.codex/config.toml` (local) | Codex OTel exporter config |
| `~/.claude/settings.json` (global) or `.claude/settings.json` (local) | Claude Code OTel env vars |
| `~/.eyes4ai/hooks/post-commit` (global) or `.git/hooks/post-commit` (local) | Git commit recording hook |
| `~/Library/LaunchAgents/com.eyes4ai.server.plist` (macOS) | Daemon auto-start config |
| `~/.config/systemd/user/com.eyes4ai.server.service` (Linux) | Daemon auto-start config |

## Background server

The global install automatically sets up a background daemon:

- **macOS**: a `launchd` agent that starts on login and restarts on failure
- **Linux**: a `systemd` user service that starts on login and restarts on failure

Logs are written to `~/.eyes4ai/logs/`.

If you need to start the server manually (e.g., for local-only installs):

```bash
npx @eyes4ai/cli serve
```

## Uninstalling

To stop and remove the background daemon:

```bash
npx @eyes4ai/cli uninstall
```

This removes the daemon config. Tool configs and git hooks are left in place — remove them manually if needed.
