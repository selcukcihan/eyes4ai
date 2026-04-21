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
    "prompt_preview": "Add repo-local AI logging with minimal friction",
    "prompt_hash": "sha256:...",
    "raw_prompt_stored": false
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
