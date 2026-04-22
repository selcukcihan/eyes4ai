# Contributing to eyes4ai

## Prerequisites

- Node.js >= 20
- npm >= 10

## Setup

```bash
git clone https://github.com/selcukcihan/eyes4ai.git
cd eyes4ai
npm install
```

## Project Structure

```
eyes4ai/
├── apps/
│   ├── cli/src/cli.ts          # CLI entry point (install, serve, report, etc.)
│   └── docs/                   # Astro Starlight docs site (user-facing)
├── packages/
│   ├── schema/src/types.ts     # Shared type definitions (EyesEvent, OTLP types)
│   ├── ingestion/
│   │   ├── src/
│   │   │   ├── server.ts              # HTTP server accepting OTLP/HTTP JSON
│   │   │   ├── normalize-dispatch.ts  # Provider-agnostic router
│   │   │   ├── normalize.ts           # Codex normalizer
│   │   │   ├── normalize-claude.ts    # Claude Code normalizer
│   │   │   ├── pricing.ts            # Token cost estimation
│   │   │   ├── install.ts            # Codex config writer
│   │   │   ├── install-claude.ts     # Claude config writer
│   │   │   ├── git-hook.ts           # Post-commit hook logic
│   │   │   ├── git-install.ts        # Git hook installer
│   │   │   ├── daemon.ts             # launchd/systemd service manager
│   │   │   ├── otel.ts               # OTel attribute parsing utilities
│   │   │   └── fs-utils.ts           # JSONL file helpers
│   │   └── test/                      # Unit + E2E tests
│   └── reporting/
│       ├── src/index.ts               # Report generation + rendering
│       └── test/index.test.ts         # Reporting tests
├── package.json                       # Workspace root, npm scripts
└── tsconfig.json
```

This is an npm workspaces monorepo. The `packages/` contain shared logic; `apps/cli` wires them into the CLI.

## Common Commands

```bash
# Type-check (no emit)
npm run check

# Build (compile TypeScript to dist/)
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run the CLI in dev mode (via tsx, no build needed)
npm run dev -- <command> [args]
# e.g. npm run dev -- install 4318
# e.g. npm run dev -- serve 4318
# e.g. npm run dev -- report --days 14
```

## Testing

Tests use the Node.js built-in test runner (`node:test`) with `tsx` for TypeScript support. No extra test framework needed.

Test files live under `test/` directories mirroring `src/`:

```
src/pricing.ts       → test/pricing.test.ts
src/normalize.ts     → test/normalize.test.ts
src/normalize-claude.ts → test/normalize-claude.test.ts
```

The E2E test (`test/e2e.test.ts`) spins up the real HTTP server on a random port, POSTs fake OTLP payloads, and asserts on the JSONL output. It uses `/tmp` for isolation.

To add a test, create a `.test.ts` file under the appropriate `test/` directory. It will be picked up automatically by the glob in `package.json`.

### Coverage

Run `npm run test:coverage` to see line/branch/function coverage. Current baseline: ~90% lines, ~88% branches.

## Adding a New AI Tool/Provider

The architecture is provider-agnostic. To add support for a new tool (e.g., Cursor, Windsurf):

1. **Create a normalizer** at `packages/ingestion/src/normalize-<tool>.ts` — export a function with signature `(attributes, timestamp, body) => EyesEvent | null`.

2. **Register in dispatch** — add a `{ detect, normalize }` entry to the `PROVIDERS` array in `normalize-dispatch.ts`. Detection checks `service.name` or event name prefix.

3. **Add pricing** — add model entries to `PRICING_TABLE` in `pricing.ts`.

4. **Add install config** (optional) — create `install-<tool>.ts` if the tool needs config files written during `eyes4ai install`.

5. **Write tests** — unit tests for the normalizer, and extend the E2E test with a fake payload for the new tool.

No changes needed in the server, reporting, or CLI modules.

## Docs Site

The user-facing docs live in `apps/docs/` and use Astro Starlight. To run locally:

```bash
cd apps/docs
npm install
npm run dev
```

To build:

```bash
npm run build
```

The site deploys to GitHub Pages via `.github/workflows/docs.yml` on push to `main`.

## Data Flow

```
AI Tool (Codex/Claude) → OTel logs → POST /v1/logs → normalize → .eyes4ai/private/events/YYYY-MM-DD.jsonl
Git commit → post-commit hook → record-commit → same JSONL
Report → reads JSONL → aggregates → renders
```

## Release

```bash
npm run build
npm publish
```

The package publishes as `@eyes4ai/cli`. Users install via `npm install -g @eyes4ai/cli`.
