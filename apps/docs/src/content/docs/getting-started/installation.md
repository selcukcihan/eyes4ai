---
title: Installation
description: How to install eyes4ai globally or per-repo.
---

## Install

```bash
npm install -g @eyes4ai/cli
```

## Global setup (recommended)

Configures all your repos at once. Run this once:

```bash
eyes4ai install --global
```

This does four things:

1. Writes Codex OTel config to `~/.codex/config.toml`
2. Writes Claude Code OTel config to `~/.claude/settings.json`
3. Installs a global Git post-commit hook via `core.hooksPath`
4. Starts the OTel ingestion server as a background daemon (auto-starts on boot)

Every repo you work in will now record AI activity and commit correlations automatically. The server runs in the background — you never have to start it manually.

:::caution[Restart your AI tools]
If Codex or Claude Code is already running, **restart it** after install. The tools only read their config at startup, so sessions started before install won't emit telemetry.
:::

:::note
The global Git hook chains to any existing repo-local `.git/hooks/post-commit`, so your existing hooks keep working.
:::

## Per-repo setup

If you prefer to enable eyes4ai for specific repos only:

```bash
cd /path/to/your/repo
eyes4ai install
```

This writes config files into the repo's `.codex/`, `.claude/`, and `.git/hooks/` directories.

## Custom port

The OTel ingestion server defaults to port 4318. To use a different port:

```bash
eyes4ai install --global 4319
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
eyes4ai serve
```

## Uninstalling

To stop and remove the background daemon:

```bash
eyes4ai uninstall
```

This removes the daemon config. Tool configs and git hooks are left in place — remove them manually if needed.
