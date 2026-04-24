---
title: Telemetry
description: What anonymous telemetry eyes4ai collects and how to disable it.
---

eyes4ai collects anonymous usage telemetry to help track adoption and catch bugs. **No personally identifiable information is ever sent.**

## What's collected

Each event includes:

- Event type (`install`, `uninstall`, `serve`, `report`)
- OS and architecture (`darwin`, `linux`, `x64`, `arm64`)
- Node.js version
- eyes4ai version
- Timestamp

That's it. No usernames, no file paths, no repo names, no prompt content.

## How to disable

Any of these will disable telemetry:

```bash
# Environment variable
export EYES4AI_NO_TELEMETRY=1

# Or the standard DO_NOT_TRACK convention
export DO_NOT_TRACK=1

# Or per-command flag
eyes4ai report --no-telemetry
```

## Implementation

Telemetry is powered by [PostHog](https://posthog.com) and is fire-and-forget. It never blocks CLI operations and failures are silently ignored. A stable anonymous ID is derived from a SHA-256 hash of your machine's hostname and username — the raw values are never sent. The source code is fully transparent — see `packages/ingestion/src/telemetry.ts`.
