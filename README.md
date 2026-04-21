# eyes4ai

`eyes4ai` is a minimal-friction AI activity ledger for Git repositories.

The current prototype focuses on Codex. It collects Codex OpenTelemetry locally, normalizes the event stream, and writes append-only JSONL files under `.ai/private/events/`.

## What It Does Today

- receives Codex OTLP/HTTP JSON logs locally
- normalizes Codex events into `eyes4ai.event.v1`
- estimates Codex credit usage from the official Codex pricing page
- estimates API-equivalent USD cost from model token pricing
- keeps raw/private AI telemetry out of git by default
- gives you a local dogfooding loop to inspect real AI activity

What it does not do yet:

- polished dashboards
- commit correlation presentation
- public/team summaries
- multi-agent support beyond Codex

## Recommended Usage

For the current prototype, the recommended path is:

1. Install dependencies:

```bash
npm install
npm run build
```

2. Start the local receiver in one terminal:

```bash
npm run dev -- serve 4318
```

3. Install Codex OTel config:

For Codex CLI in this repo:

```bash
npm run dev -- install 4318
```

For Codex Desktop, the more reliable current setup is to place the same OTel block in `~/.codex/config.toml` and restart the app fully.

4. Use Codex normally.

5. Inspect the resulting event file:

```bash
tail -f .ai/private/events/$(date -u +%F).jsonl
```

If you collected events before a normalizer upgrade, reprocess them in place with:

```bash
npm run dev -- reprocess .ai/private/events/$(date -u +%F).jsonl
```

Because this project is still in active development and not yet customer-facing, the preferred approach is to wipe and regenerate local telemetry when a schema or normalization change makes that cleaner. Do not treat `.ai/private/` data as durable at this stage.

## Commands

- `npm run dev -- serve 4318`
  Starts the local OTLP/HTTP JSON receiver.
- `npm run dev -- install 4318`
  Writes repo-local Codex config that points to the local receiver.
- `npm run dev -- reprocess <file>`
  Re-runs the latest normalizer against an existing JSONL file.
- `npm run dev -- report`
  Prints a repo-level summary from collected AI telemetry.
- `npm run dev -- report --json`
  Prints the same summary as JSON.
- `npm run check`
  Type-checks the project.
- `npm run build`
  Builds the CLI into `dist/`.

## Data Layout

Current local files:

- `.ai/private/events/*.jsonl`
  Local normalized event stream.
- `.ai/prompt-log.jsonl`
  Append-only repo log of prompts that changed tracked files.
- `.codex/config.toml`
  Repo-local Codex OTel config used for dogfooding.

Current repo layout:

- `apps/cli`
  User-facing CLI surface.
- `packages/schema`
  Shared event and telemetry types.
- `packages/ingestion`
  OTLP receiver, normalizer, installer, and pricing logic.
- `packages/reporting`
  Repo-level summaries and presentation logic.

## Git Policy

Recommended default:

- do not commit `.ai/private/`
- do not commit `.ai/state/`
- do not commit raw event logs
- only commit stable config or curated summaries later if explicitly desired

The current repo ignores the private event stream by default because raw AI telemetry is noisy and may contain sensitive metadata.

## Current Limitations

- Codex Desktop currently appears to honor global `~/.codex/config.toml` more reliably than repo-local `.codex/config.toml` for OTel settings.
- The normalizer is improving, but some Codex events still fall through as `codex.raw`.
- Transport-level events are intentionally noisy and are not yet collapsed into user-facing summaries.
- Cost is an estimate, not invoice-equivalent billing.
- Codex product usage and API-key usage do not map to the same unit. The report now shows Codex credits when the official Codex rate card covers the model, and also shows an API-equivalent USD estimate.
- Local development data is disposable for now. Backwards compatibility for `.ai/private/` telemetry is intentionally not a goal during this phase.

## Product Direction

The direction remains:

- install once
- keep using your AI tool normally
- record append-only AI activity with repo context
- stay passive by default

The core artifact is not a workflow CLI. The core artifact is a repo-local standard:

- `.ai/` for normalized AI activity data
- Codex OpenTelemetry as the primary capture source
- Git hooks for commit correlation

## Additional Docs

- [Codex MVP](/Users/selcukcihan/code/eyes4ai/docs/codex-mvp.md)
- [Event Schema](/Users/selcukcihan/code/eyes4ai/docs/schema.md)
