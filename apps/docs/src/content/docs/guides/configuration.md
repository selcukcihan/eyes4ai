---
title: Configuration
description: How eyes4ai configures each AI tool and Git.
---

eyes4ai configures each supported AI tool to export OpenTelemetry logs to a local HTTP endpoint. No manual config editing needed — `install` handles everything.

## Codex

eyes4ai writes an `[otel]` block to Codex's config file:

**Global:** `~/.codex/config.toml`
**Local:** `.codex/config.toml`

```toml
# eyes4ai:begin
[otel]
environment = "dev"
log_user_prompt = false
exporter = { otlp-http = { endpoint = "http://127.0.0.1:4318/v1/logs", protocol = "json" } }
trace_exporter = "none"
metrics_exporter = "none"
# eyes4ai:end
```

The `# eyes4ai:begin/end` markers let eyes4ai update its config block without touching your other Codex settings.

Raw prompts are **not** logged (`log_user_prompt = false`). Only prompt hashes and redacted previews are stored.

## Claude Code

eyes4ai adds OTel environment variables to Claude Code's settings:

**Global:** `~/.claude/settings.json`
**Local:** `.claude/settings.json`

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "http://127.0.0.1:4318"
  }
}
```

Existing settings in the file are preserved — only the `env` key is merged.

## Git hook

eyes4ai installs a `post-commit` hook that records each commit and correlates it with recent AI sessions.

**Global:** `~/.eyes4ai/hooks/post-commit` (via `git config --global core.hooksPath`)
**Local:** `.git/hooks/post-commit`

The hook is non-blocking — it runs in the background and failures are silently ignored. It will never slow down your commits.

The global hook also chains to any repo-local `.git/hooks/post-commit` that exists, since `core.hooksPath` overrides `.git/hooks/` entirely.

## Data storage

All event data is stored locally:

```
.eyes4ai/
  private/
    events/
      2026-04-21.jsonl    # append-only daily event logs
```

The `private/` directory should be in your `.gitignore` (it is by default). Event data never leaves your machine unless you explicitly share it.

## Precedence

Both Codex and Claude Code support config layering. Repo-local config overrides global config. This means you can:

- Install globally for convenience
- Override in specific repos if needed (e.g., different port, disable for a repo)
