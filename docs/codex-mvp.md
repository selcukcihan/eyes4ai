# Codex MVP

## Problem Statement

Current AI usage logging inside repositories is too manual. The common pattern is a handwritten instruction in `AGENTS.md` that tells the coding agent to append prompt text somewhere. That is brittle, incomplete, and easy to forget.

The Codex MVP should replace that with automatic capture that feels invisible during normal work.

## Goal

Create a Codex-first installer that sets up repo-local capture with near-zero ongoing ceremony.

User experience target:

1. Run one install command.
2. Continue using Codex normally.
3. Get append-only AI activity records correlated with Git work.

## Why Codex-Only Is A Good MVP

Codex already gives us the primitives we need:

- an OpenTelemetry layer with Codex-specific session events
- repo-local `.codex/config.toml` for enabling hook behavior at the project layer

Current OpenAI Codex docs also state that the CLI and IDE extension share the same configuration layers. That means the integration path can be repo-scoped instead of surface-specific.

Inference:

If the Codex desktop app is operating on a local project through the same trusted project configuration model, the correct MVP integration point is still the repo-local `.codex/` layer. We do not need separate product behavior for CLI versus desktop in v1 unless later testing proves a gap.

## MVP Shape

### Install

The installer should:

- create `.ai/`
- create `.codex/config.toml` if missing, or patch it minimally if present with OTel settings
- create `.githooks/`
- configure `core.hooksPath` to `.githooks`

The daily workflow should not require special commands.

### Capture

Codex OTel should be the primary telemetry source.

The adapter should ingest Codex OTel logs, traces, and metrics, then write normalized append-only JSONL events.

Primary source:

- Codex OTel session events
- Codex OTel metrics
- Codex OTel trace-safe events

Secondary source:

- Git hooks for commit correlation
- optional Codex hooks only when we want local fallback or extra repo-specific enrichment

## What We Can Log In An OTel-First Codex MVP

Based on the current Codex source and docs, the MVP should separate fields into three buckets.

### Guaranteed From Current Codex OTel Events

- conversation id
- active model slug
- app version
- originator
- session source
- terminal type
- token counts on completed SSE events:
  `input_token_count`, `output_token_count`, `cached_token_count`, `reasoning_token_count`, `tool_token_count`
- timing data on several events:
  `duration_ms`, websocket timings, API timings, turn timing metrics
- tool results:
  `tool_name`, `call_id`, `duration_ms`, `success`
- MCP metadata on tool results when applicable:
  `mcp_server`, `mcp_server_origin`

### Derived By Our Own Recorder

- event timestamp
- normalized session id if we want a stable cross-source key distinct from Codex conversation id
- prompt hash
- prompt preview
- session timeline
- estimated cost in USD from model pricing tables and token counts
- commit correlation
- file-touch summaries from Git state and repo diffs

### Available But Privacy-Sensitive Or Config-Dependent

- raw prompt text, if `log_user_prompt = true`
- raw tool arguments in log events
- raw tool output in log events
- user account id and user email in log events

These should not be required for the MVP. The product should work in a privacy-preserving mode without depending on them.

### Not Reliably Available As A First-Pass Product Claim

- authoritative billed dollar cost from Codex itself
- complete accounting for tool-specific surcharges unless pricing is separately modeled
- full parity between CLI project-scoped OTel config and desktop app project-scoped OTel config

Current Codex source shows an OTel layer that emits `codex.user_prompt`, `codex.tool_result`, `codex.sse_event`, `codex.api_request`, websocket events, and token counts on completed SSE events. It also shows configuration for `log_user_prompt`, exporters, traces, and metrics.

Inference:

For the Codex-only MVP, we should promise:

- model used
- token counts
- timing data
- tool usage
- estimated token-based cost

We should not promise:

- exact invoice-equivalent cost
- perfect desktop/config parity until verified in the desktop app
- raw prompt and raw tool payload collection by default

Those can be designed as future fields with nullable values.

### Correlation

Git hooks should not try to discover prompt data. They should only:

- snapshot commit metadata
- link recent AI session ids
- write commit correlation records

### Storage

Proposed repo layout:

```text
.ai/
  config.yaml
  prompt-log.jsonl
  private/
    events/
      2026-04-21.jsonl
  state/
    active-session.json
    recent-sessions.json
  public/
    summaries/
      2026-04-21.jsonl
.codex/
  config.toml
.githooks/
  pre-commit
  post-commit
```

## Event Schema

The ledger needs one normalized schema across future adapters.

Example prompt event:

```json
{
  "schema": "eyes-for-ai.event.v1",
  "event_id": "evt_01",
  "timestamp": "2026-04-21T09:19:55Z",
  "session_id": "sess_01",
  "source": {
    "kind": "codex_otel_log",
    "surface": "codex",
    "event": "codex.user_prompt"
  },
  "type": "ai.prompt",
  "data": {
    "model": "gpt-5.4",
    "prompt_preview": "Add repo-local AI logging with minimal friction",
    "prompt_hash": "sha256:...",
    "raw_prompt_stored": false,
    "token_usage": null,
    "latency_ms": null,
    "estimated_cost_usd": null
  }
}
```

Example tool event:

```json
{
  "schema": "eyes-for-ai.event.v1",
  "event_id": "evt_01b",
  "timestamp": "2026-04-21T09:21:02Z",
  "session_id": "sess_01",
  "source": {
    "kind": "codex_otel_log",
    "surface": "codex",
    "event": "codex.tool_result"
  },
  "type": "ai.tool_use.post",
  "data": {
    "tool_name": "shell",
    "tool_use_id": "call-1",
    "duration_ms": 42,
    "success": true,
    "mcp_server": "internal-mcp",
    "observed_via_otel": true
  }
}
```

Example token accounting event:

```json
{
  "schema": "eyes-for-ai.event.v1",
  "event_id": "evt_01c",
  "timestamp": "2026-04-21T09:22:00Z",
  "session_id": "sess_01",
  "source": {
    "kind": "codex_otel_log",
    "surface": "codex",
    "event": "codex.sse_event"
  },
  "type": "ai.usage",
  "data": {
    "model": "gpt-5.4",
    "input_token_count": 12000,
    "output_token_count": 1800,
    "cached_token_count": 3000,
    "reasoning_token_count": 900,
    "tool_token_count": 250,
    "estimated_cost_usd": 0.0495,
    "cost_basis": "token_estimate_only"
  }
}
```

Example commit correlation event:

```json
{
  "schema": "eyes-for-ai.event.v1",
  "event_id": "evt_02",
  "timestamp": "2026-04-21T09:30:00Z",
  "source": {
    "kind": "git_hook",
    "event": "post-commit"
  },
  "type": "git.commit",
  "data": {
    "commit": "abc123",
    "branch": "main",
    "files_changed": [
      "README.md",
      "docs/codex-mvp.md"
    ],
    "related_ai_sessions": [
      "sess_01"
    ]
  }
}
```

## Privacy Defaults

Default behavior should be conservative:

- store prompt previews plus hashes, not mandatory raw prompts
- keep detailed event traces local-first
- keep commit flow non-blocking
- support optional public summaries later

## Observability Policy

For v1, the log schema should include these fields:

- `model`
- `token_usage`
- `latency_ms`
- `estimated_cost_usd`
- `tool_name`

Reason:

- it keeps the schema stable
- it allows adapters from future tools to fill more fields
- it lets us map Codex OTel fields directly without losing fidelity

## Cost Estimation Policy

`estimated_cost_usd` should be computed by us.

First-pass formula:

- input tokens use the model input price
- cached tokens use the model cached-input price when available
- output tokens use the model output price

Important caveat:

- tool-specific pricing may apply separately in OpenAI pricing and may not be fully reflected by token counts alone

So the first estimator should expose both:

- `estimated_cost_usd`
- `cost_basis`

Initial `cost_basis` values:

- `token_estimate_only`
- `token_estimate_plus_modeled_tool_fees`
- `unknown`

## Implementation Direction

The next implementation should be an OTel adapter, not a hook parser.

That means:

1. define a local OTel ingestion path for Codex
2. map Codex OTel events into `eyes-for-ai.event.v1`
3. maintain a model pricing table keyed by model slug and date
4. compute `estimated_cost_usd` from token counts
5. use Git hooks only for commit correlation
6. keep hooks optional for fallback or repo-specific enrichment

## Open Product Decisions

These need your input before code implementation locks them in:

- Should detailed `.ai/private/` data be committed, ignored, or configurable by default?
- Should commit correlation live in files, commit trailers, Git notes, or a mix?
- Should the installer be a shell script first, or do you want the project to start in a specific language runtime?
