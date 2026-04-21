# eyes-for-ai

`eyes-for-ai` is a minimal-friction AI activity ledger for Git repositories.

The product direction is:

- Install once.
- Keep using your AI tool normally.
- Record append-only AI activity with repo context.
- Stay passive by default.

## What We Are Building

The core artifact is not a CLI workflow. The core artifact is a repo-local standard:

- `.ai/` for normalized AI activity data
- Codex OpenTelemetry as the primary capture source
- Git hooks for commit correlation

The CLI should exist only as an installer, validator, and debugging surface.

## MVP

The MVP starts with Codex only.

Why Codex first:

- Codex already has an OpenTelemetry layer in the open-source codebase.
- Codex telemetry already emits session events, tool results, token counts, and timing data.
- Codex already supports repo-local `.codex/config.toml`.
- Current OpenAI Codex docs indicate the CLI and IDE extension share the same configuration layers, which makes a single repo-local integration path viable for Codex surfaces.

The first version should work for:

- Codex CLI
- Codex desktop app / IDE-backed local Codex workflows that honor the same repo-scoped `.codex/` config

## Dogfood Loop

The first local loop is:

1. Start the local receiver with `npm run dev -- serve 4318`
2. Install repo-local Codex config with `npm run dev -- install 4318`
3. Use Codex normally in this repo
4. Inspect normalized events under `.ai/private/events/*.jsonl`

The current implementation focuses on OTLP/HTTP JSON log ingestion first. That is enough to prove the normalization path, token capture, and token-based cost estimation.

## Product Principles

- Passive by default, not blocking
- Privacy-preserving by default
- Append-only logs
- Git-friendly outputs
- Repo-local installation
- Minimal user ceremony

## Non-Goals For The First Cut

- Multi-agent vendor support beyond Codex
- SaaS backend
- Dashboard-heavy reporting
- Mandatory committed raw prompts
- Policy enforcement that blocks normal coding flows

## First Implementation Slice

1. Install repo-local Codex config for OTel export.
2. Enable and route Codex OTel logs/traces/metrics into our local collector or adapter.
3. Normalize OTel events into `.ai/private/events/*.jsonl`.
4. Correlate recent AI sessions to Git commits through repo-local Git hooks.
5. Estimate token-based cost from model pricing tables and emitted token counts.
6. Emit a small public or local-only summary view for debugging.

See [docs/codex-mvp.md](/Users/selcukcihan/code/eyes-for-ai/docs/codex-mvp.md) for the concrete MVP shape.
See [docs/schema.md](/Users/selcukcihan/code/eyes-for-ai/docs/schema.md) for the first normalized event contract.
