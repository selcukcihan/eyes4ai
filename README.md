# eyes4ai

`eyes4ai` records AI activity for a Git repository without changing the way you work. In the current prototype, it listens to Codex telemetry locally, turns that stream into one normalized event format, and writes append-only JSONL files under `.eyes4ai/`.

## How It Works

1. Start the local receiver:

```bash
npm run dev -- serve 4318
```

2. Point Codex at it:

```bash
npm run dev -- install 4318
```

3. Keep using Codex normally.

4. `eyes4ai` receives the telemetry, normalizes it, and appends events to the local ledger:

```bash
tail -f .eyes4ai/private/events/$(date -u +%F).jsonl
```

If the schema or normalizer changes, the current prototype treats local telemetry as disposable. Reprocessing or wiping `.eyes4ai/private/` is preferred over carrying migration complexity.

## What Data It Sources

Current primary source:

- Codex OpenTelemetry logs sent over local OTLP/HTTP to `http://127.0.0.1:4318/v1/logs`

From that stream, `eyes4ai` currently derives or preserves:

- prompt events
- usage and token counts
- tool execution metadata
- session metadata
- transport and request timing signals
- estimated cost fields
- fallback raw Codex events when a record is not normalized yet

The project is currently Codex-first. It does not yet claim broad multi-agent coverage.

## How It Stores Data Locally

Local storage is repo-local and append-only:

- `.eyes4ai/private/events/*.jsonl`
  Normalized event stream
- `.eyes4ai/prompt-log.jsonl`
  Append-only log of prompts that changed tracked files
- `.codex/config.toml`
  Local Codex configuration that points telemetry at the receiver

The normalized event schema is `eyes4ai.event.v1`. Each stored event uses this top-level shape:

```json
{
  "schema": "eyes4ai.event.v1",
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

Required top-level fields:

- `schema`
- `eventId`
- `timestamp`
- `sessionId`
- `source.kind`
- `source.event`
- `type`
- `data`

Current normalized event types:

- `ai.prompt`
- `ai.usage`
- `ai.tool_use.post`
- `ai.session.start`
- `ai.transport`
- `ai.tool_decision`
- `git.commit`
- `codex.raw`

The full schema reference lives in [docs/schema.md](/Users/selcukcihan/code/eyes4ai/docs/schema.md).

## Quick Commands

- `npm run dev -- serve 4318`
- `npm run dev -- install 4318`
- `npm run dev -- reprocess <file>`
- `npm run dev -- report`
- `npm run dev -- report --json`
- `npm run check`
- `npm run build`
