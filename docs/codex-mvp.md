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

Codex already gives us the two primitives we need:

- repo-local `.codex/hooks.json` for lifecycle capture
- repo-local `.codex/config.toml` for enabling hook behavior at the project layer

Current OpenAI Codex docs also state that the CLI and IDE extension share the same configuration layers. That means the integration path can be repo-scoped instead of surface-specific.

Inference:

If the Codex desktop app is operating on a local project through the same trusted project configuration model, the correct MVP integration point is still the repo-local `.codex/` layer. We do not need separate product behavior for CLI versus desktop in v1 unless later testing proves a gap.

## MVP Shape

### Install

The installer should:

- create `.ai/`
- create `.codex/hooks.json`
- create `.codex/config.toml` if missing, or patch it minimally if present
- create `.githooks/`
- configure `core.hooksPath` to `.githooks`

The daily workflow should not require special commands.

### Capture

Codex hooks should write normalized events into append-only JSONL files:

- `UserPromptSubmit` -> `ai.prompt`
- `PreToolUse` -> `ai.tool_use.pre`
- `PostToolUse` -> `ai.tool_use.post`
- `Stop` -> `ai.turn.stop`
- optional `SessionStart` -> `ai.session.start`

## What We Can Log In A Codex MVP

Based on the current Codex hooks documentation, the MVP should separate fields into three buckets.

### Guaranteed From Current Codex Hook Inputs

- session id
- turn id
- current working directory
- transcript path when available
- active model slug
- user prompt text on `UserPromptSubmit`
- Bash tool command before execution on `PreToolUse`
- Bash tool command and Bash tool response on `PostToolUse`
- last assistant message on `Stop` when available

### Derived By Our Own Recorder

- event timestamp
- prompt hash
- prompt preview
- session timeline
- per-turn elapsed time that we compute between hook events
- commit correlation
- inferred file-touch set from observed Bash commands and Git state

### Not Reliably Available From Current Codex Hooks

- token usage
- exact latency from Codex itself
- exact dollar cost from Codex itself
- complete cross-tool usage for all Codex tools

Current Codex docs document `model` in the common hook input fields and document `prompt` for `UserPromptSubmit`. They also document that `PreToolUse` and `PostToolUse` currently only support `Bash`, and explicitly note that they do not currently intercept MCP, Write, WebSearch, or other non-shell tools.

Inference:

For the Codex-only MVP, we should promise:

- model used
- prompt submitted
- Bash tool activity observed through hooks
- approximate turn timing we compute ourselves

We should not promise:

- authoritative token counts
- authoritative cost
- complete tool inventory across every Codex capability

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
  hooks.json
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
    "kind": "codex_hook",
    "surface": "codex",
    "event": "UserPromptSubmit"
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

Example observed Bash tool event:

```json
{
  "schema": "eyes-for-ai.event.v1",
  "event_id": "evt_01b",
  "timestamp": "2026-04-21T09:21:02Z",
  "session_id": "sess_01",
  "turn_id": "turn_01",
  "source": {
    "kind": "codex_hook",
    "surface": "codex",
    "event": "PostToolUse"
  },
  "type": "ai.tool_use.post",
  "data": {
    "tool_name": "Bash",
    "tool_use_id": "toolu_01",
    "command": "git status --short",
    "observed_via_hook": true
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

For v1, the log schema should include these fields even when they are unavailable:

- `model`
- `token_usage`
- `latency_ms`
- `estimated_cost_usd`
- `tool_name`

Reason:

- it keeps the schema stable
- it allows adapters from future tools to fill more fields
- it prevents us from pretending Codex provides data that it does not currently expose

## Open Product Decisions

These need your input before code implementation locks them in:

- Should detailed `.ai/private/` data be committed, ignored, or configurable by default?
- Should commit correlation live in files, commit trailers, Git notes, or a mix?
- Should the installer be a shell script first, or do you want the project to start in a specific language runtime?

## Recommended Next Build Step

Build the installer and hooks for Codex only, with no external dependencies if possible.

That means:

1. repo bootstrap
2. minimal hook scripts
3. normalized JSONL writer
4. Git hook correlation
5. one local debug command that prints recent sessions and linked commits
