---
title: Architecture
description: How eyes4ai works under the hood.
---

eyes4ai has three layers: ingestion, storage, and reporting.

## Data flow

```
AI coding tools (Codex, Claude Code, ...)
        │
        │  OpenTelemetry logs (OTLP/HTTP JSON)
        ▼
eyes4ai server (POST /v1/logs)
        │
        │  Detect source → normalize to eyes4ai.event.v1
        ▼
.eyes4ai/private/events/YYYY-MM-DD.jsonl
        │
        ▲
Git post-commit hook
        │
        │  Record commit metadata + correlate with recent AI sessions
        ▼
.eyes4ai/private/events/YYYY-MM-DD.jsonl
        │
        │  eyes4ai report
        ▼
Period-filtered aggregation + yield metrics
```

## Ingestion

The ingestion server receives standard OTLP/HTTP JSON log records at `/v1/logs`. A dispatch layer detects the source tool from OTel attributes and routes to the appropriate normalizer.

**Provider detection** checks `service.name` and event name prefixes:

- `codex.*` events or `service.name` containing "codex" → Codex normalizer
- `claude_code.*` events or `service.name` containing "claude" → Claude normalizer
- Unknown → Codex normalizer (backward-compatible default)

Each normalizer maps tool-specific attributes to the canonical `eyes4ai.event.v1` schema. Adding a new tool means writing one normalizer function and registering it in the dispatch — no changes to storage, reporting, or the server.

## Storage

Events are stored as append-only JSONL files, partitioned by day:

```
.eyes4ai/private/events/
  2026-04-19.jsonl
  2026-04-20.jsonl
  2026-04-21.jsonl
```

No database. No migrations. Files can be deleted, moved, or archived freely.

## Git correlation

The post-commit hook runs after each commit and:

1. Reads commit metadata via `git diff-tree --numstat` (hash, branch, files, lines added/deleted)
2. Scans recent event files for AI sessions active within 2 hours before the commit
3. Writes a `git.commit` event linking the commit to those sessions

The hook runs in the background and is non-blocking.

## Reporting

The report generator loads all JSONL events, filters by date range, and computes:

- **AI activity** — unique sessions, turns (prompts), active days, estimated cost
- **Committed output** — AI-linked commits, files, lines changed
- **Yield** — session-to-commit rate, cost per commit, abandoned sessions
- **Trend** — comparison with the previous period

Per-tool breakdowns are derived from `source.surface` on each event.

## Privacy

By default:

- Raw prompts are **not** stored — only SHA-256 hashes and truncated previews
- Sensitive OTel attributes (email, account ID) are redacted during normalization
- All data stays under `.eyes4ai/private/`, which is gitignored
- The Codex config sets `log_user_prompt = false`
