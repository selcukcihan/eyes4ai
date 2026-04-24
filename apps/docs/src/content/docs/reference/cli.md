---
title: CLI Commands
description: Complete reference for the eyes4ai command-line interface.
---

## --version

Print the installed version.

```bash
eyes4ai --version
```

Also accepts `-v` and `version` (without dashes).

## install

Configure AI tools and Git hooks to record activity.

```bash
eyes4ai install [port] [--global]
```

**Arguments:**

- `port` — OTel server port (default: `4318`)
- `--global` — Install to user-level config files instead of repo-local

**What it does:**

| Mode | Codex config | Claude config | Git hook |
|------|-------------|---------------|----------|
| Local (default) | `.codex/config.toml` | `.claude/settings.json` | `.git/hooks/post-commit` |
| `--global` | `~/.codex/config.toml` | `~/.claude/settings.json` | `~/.eyes4ai/hooks/post-commit` |

Global mode also sets `git config --global core.hooksPath`, chains to repo-local hooks (Husky, Lefthook, and plain `.git/hooks/`), and starts a background daemon (launchd on macOS, systemd on Linux) so the server auto-starts on boot. Local mode appends to any existing post-commit hook rather than replacing it.

## uninstall

Stop and remove the background daemon.

```bash
eyes4ai uninstall
```

Removes the launchd plist or systemd service. Tool configs and git hooks are left in place.

## serve

Start the OTel ingestion server.

```bash
eyes4ai serve [port]
```

**Arguments:**

- `port` — HTTP port to listen on (default: `4318`)

**Endpoints:**

- `GET /` — Web dashboard with charts and share button
- `GET /api/report?days=N` — JSON report API
- `POST /v1/logs` — Accepts OTLP/HTTP JSON log records
- `GET /health` — Health check

The dashboard is available at `http://127.0.0.1:4318` when the server is running.

Events are written to `.eyes4ai/private/events/YYYY-MM-DD.jsonl` in the current working directory.

## report

Generate an AI activity report.

```bash
eyes4ai report [--days N] [--json] [--legacy]
```

**Flags:**

- `--days N` — Reporting period in days (default: `7`)
- `--json` — Output as JSON instead of plain text
- `--legacy` — Use the old report format (token totals, histogram, tool invocations)

## record-commit

Manually record a Git commit as an eyes4ai event.

```bash
eyes4ai record-commit [hash]
```

**Arguments:**

- `hash` — Commit hash to record (default: `HEAD`)

Normally called automatically by the post-commit hook. Use this to backfill commits or debug.

## reprocess

Re-normalize events in a JSONL file.

```bash
eyes4ai reprocess [file]
```

**Arguments:**

- `file` — Path to JSONL file (default: today's event file)

Useful when the schema or pricing tables change. Recalculates costs and re-normalizes raw events.
