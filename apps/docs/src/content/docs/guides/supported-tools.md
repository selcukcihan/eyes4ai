---
title: Supported Tools
description: AI coding tools that work with eyes4ai.
---

eyes4ai uses OpenTelemetry as its ingestion protocol. Any AI coding tool that can export OTel logs can work with eyes4ai. Currently, two tools have built-in support with automatic configuration.

## Codex

OpenAI's Codex has native OTel log export. eyes4ai configures it via `.codex/config.toml`.

**Events captured:**

| Event | What it records |
|-------|----------------|
| `codex.user_prompt` | Prompt hash, redacted preview |
| `codex.sse_event` (response.completed) | Token counts, model, estimated cost |
| `codex.tool_result` | Tool name, duration, success/failure |
| `codex.tool_decision` | Tool approval/denial |
| `codex.conversation_starts` | Session start, model, MCP servers |
| `codex.websocket_*` | Transport-level events |

## Claude Code

Anthropic's Claude Code exports OTel logs when configured with the right environment variables. eyes4ai sets these in `.claude/settings.json`.

**Events captured:**

| Event | What it records |
|-------|----------------|
| `claude_code.user_prompt` | Prompt hash, redacted preview |
| `claude_code.api_request` | Token counts, model, cost, duration |
| `claude_code.tool_result` | Tool name, duration, success/failure |
| `claude_code.tool_decision` | Tool approval/denial |

## Adding a new tool

eyes4ai's ingestion server accepts standard OTLP/HTTP JSON at `POST /v1/logs`. To add support for a new tool:

1. Configure the tool to export OTel logs to `http://127.0.0.1:4318/v1/logs`
2. Add a normalizer in `packages/ingestion/src/` that maps the tool's event attributes to the `eyes4ai.event.v1` schema
3. Register the normalizer's `detect` + `normalize` functions in `normalize-dispatch.ts`
4. Optionally add pricing entries in `pricing.ts`
5. Optionally add an install config module

The provider detection uses OTel resource attributes (`service.name`) and event name prefixes to route to the correct normalizer. Unknown events are stored as `raw` type and can be normalized later via `reprocess`.
