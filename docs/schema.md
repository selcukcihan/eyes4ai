# Event Schema

`eyes-for-ai.event.v1` is the normalized append-only event format written to `.ai/private/events/*.jsonl`.

## Top-Level Shape

```json
{
  "schema": "eyes-for-ai.event.v1",
  "eventId": "uuid",
  "timestamp": "2026-04-21T10:00:00.000Z",
  "sessionId": "thread_123",
  "source": {
    "kind": "codex_otel_log",
    "surface": "codex",
    "event": "codex.sse_event"
  },
  "type": "ai.usage",
  "data": {}
}
```

## Required Fields

- `schema`
- `eventId`
- `timestamp`
- `sessionId`
- `source.kind`
- `source.event`
- `type`
- `data`

## Event Types

### `ai.prompt`

Used for normalized prompt submission events.

Current fields:

- `model`
- `promptPreview`
- `promptHash`
- `rawPromptStored`

### `ai.usage`

Used for usage and token accounting events.

Current fields:

- `model`
- `inputTokenCount`
- `outputTokenCount`
- `cachedTokenCount`
- `reasoningTokenCount`
- `toolTokenCount`
- `estimatedCostUsd`
- `estimatedCreditCost`
- `costBasis`

### `ai.tool_use.post`

Used for completed tool-use events.

Current fields:

- `toolName`
- `toolUseId`
- `durationMs`
- `success`
- `mcpServer`
- `mcpServerOrigin`
- `observedViaOtel`

### `ai.session.start`

Used for normalized session-start events.

Current fields:

- `model`
- `providerName`
- `reasoningEffort`
- `reasoningSummary`
- `approvalPolicy`
- `sandboxPolicy`
- `mcpServers`

### `ai.transport`

Used for normalized transport-level events that may later be compacted into higher-level summaries.

Current fields:

- `category`
- `eventKind`
- `durationMs`
- `success`
- `connectionReused`
- `endpoint`

### `ai.tool_decision`

Used for tool approval or decision events.

Current fields:

- `toolName`
- `toolUseId`
- `decision`
- `decisionSource`

### `git.commit`

Used for Git correlation events.

Current fields:

- `commit`
- `branch`
- `filesChanged`
- `relatedAiSessions`

### `codex.raw`

Fallback event for Codex OTel data we do not normalize yet.

Current fields:

- `model`
- `attributes`
- `body`

## Cost Basis

Current values:

- `token_estimate_only`
- `credit_estimate_only`
- `token_and_credit_estimate`
- `token_estimate_plus_modeled_tool_fees`
- `unknown`

`estimatedCostUsd` is intentionally an estimate, not a billing claim.
`estimatedCreditCost` is also an estimate and is intended to track Codex product credit usage from the published Codex pricing table, not actual invoiced spend.
