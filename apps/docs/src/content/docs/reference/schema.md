---
title: Event Schema
description: Reference for the eyes4ai.event.v1 event format.
---

All events follow the `eyes4ai.event.v1` schema. Events are stored as newline-delimited JSON (JSONL) in `.eyes4ai/private/events/YYYY-MM-DD.jsonl`.

## Envelope

Every event has this structure:

```json
{
  "schema": "eyes4ai.event.v1",
  "eventId": "uuid",
  "timestamp": "2026-04-21T10:00:00.000Z",
  "sessionId": "session-uuid",
  "source": {
    "kind": "codex_otel_log",
    "surface": "codex",
    "event": "codex.user_prompt"
  },
  "type": "ai.prompt",
  "data": {}
}
```

**Fields:**

- `schema` — Always `"eyes4ai.event.v1"`
- `eventId` — Unique UUID for this event
- `timestamp` — ISO 8601 timestamp
- `sessionId` — Groups events from the same AI session
- `source.kind` — How the event was captured (e.g., `codex_otel_log`, `claude_otel_log`, `git_hook`)
- `source.surface` — Which tool produced it (`codex`, `claude`, `git`)
- `source.event` — The original event name from the tool
- `type` — Normalized event type (see below)

## Event types

### ai.prompt

A user prompt was submitted.

```json
{
  "model": "gpt-5.4",
  "promptPreview": "Refactor the auth middleware to...",
  "promptHash": "sha256...",
  "rawPromptStored": false
}
```

### ai.usage

Token usage and cost for one API response.

```json
{
  "model": "claude-sonnet-4-6",
  "inputTokenCount": 5000,
  "outputTokenCount": 1200,
  "cachedTokenCount": 2000,
  "reasoningTokenCount": 400,
  "estimatedCostUsd": 0.033,
  "costBasis": "token_estimate_only"
}
```

### ai.tool_use.post

A tool invocation completed.

```json
{
  "toolName": "edit_file",
  "durationMs": 84,
  "success": true,
  "mcpServer": "computer-use",
  "observedViaOtel": true
}
```

### ai.session.start

An AI session began.

```json
{
  "model": "gpt-5.4",
  "providerName": "OpenAI",
  "reasoningEffort": "medium",
  "mcpServers": ["computer-use", "codex_apps"]
}
```

### ai.tool_decision

A tool was approved or denied.

```json
{
  "toolName": "shell",
  "decision": "accept",
  "decisionSource": "config"
}
```

### ai.transport

Transport-level event (WebSocket connections, requests).

```json
{
  "category": "websocket_connect",
  "durationMs": 120,
  "success": true,
  "connectionReused": false
}
```

### git.commit

A Git commit was recorded (by the post-commit hook).

```json
{
  "commit": "abc123def456",
  "branch": "main",
  "filesChanged": ["src/auth.ts", "test/auth.test.ts"],
  "linesAdded": 42,
  "linesDeleted": 18,
  "relatedAiSessions": ["session-uuid-1", "session-uuid-2"]
}
```

### raw

An event that couldn't be fully normalized. Preserved for future reprocessing.

```json
{
  "attributes": { "...": "..." },
  "body": "..."
}
```
