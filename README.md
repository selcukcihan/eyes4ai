# eyes4ai

Passive AI activity recorder for Git repositories. Tracks usage across OpenAI Codex, Claude Code, and more — all data stays local.

<p align="center">
  <img src="apps/docs/src/assets/architecture.svg" alt="eyes4ai architecture" width="800">
</p>

## What it does

eyes4ai sits in the background and records how AI coding tools are used in your repos:

- **Sessions, turns, and token costs** — broken down per tool when you use multiple
- **Git commit correlation** — which AI sessions led to actual commits
- **Yield metrics** — session-to-commit rate, cost per commit, abandoned sessions
- **Trend comparison** — current vs. previous period

It uses OpenTelemetry to passively capture telemetry that Codex and Claude Code already emit. No code changes, no wrappers, no proxies.

## Quick start

```bash
# Install globally (configures Codex, Claude Code, git hooks, auto-start daemon)
npx @eyes4ai/cli install 4318 --global

# Or install for a single repo
cd your-repo
npx @eyes4ai/cli install 4318
npx @eyes4ai/cli serve 4318
```

That's it. Use your AI tools as usual. When you want a report:

```bash
npx @eyes4ai/cli report --days 7
```

```
AI activity
  Sessions:              12  (codex: 8, claude: 4)
  Turns:                 87  (codex: 55, claude: 32)
  AI-active days:        5 / 7
  Estimated cost:        $4.23  (codex: $2.80, claude: $1.43)

Committed output
  AI-linked commits:     9
  Lines changed:         +1,247 / -382

Yield
  Session-to-commit rate:  75%
  Avg cost per commit:     $0.47
  Abandoned sessions:      3
```

## How it works

1. **Install** configures your AI tools to emit OpenTelemetry logs to a local endpoint
2. **A lightweight server** receives OTLP/HTTP payloads, normalizes them, and appends to daily JSONL files
3. **Git post-commit hooks** capture commit metadata and link commits to recent AI sessions
4. **Reports** aggregate the local data into actionable metrics

All data lives in `.eyes4ai/private/events/` — nothing leaves your machine.

## Commands

| Command | Description |
|---------|-------------|
| `install [port] [--global]` | Configure AI tools, git hooks, and (with --global) auto-start daemon |
| `uninstall` | Remove the background daemon |
| `serve [port]` | Start the OTel ingestion server |
| `report [--days N] [--json]` | Generate an activity report |
| `record-commit [hash]` | Manually record a commit |
| `reprocess [file]` | Re-normalize events (after schema/pricing updates) |

## Supported tools

| Tool | Status | Detection |
|------|--------|-----------|
| OpenAI Codex CLI | Supported | `codex.*` OTel events |
| Claude Code | Supported | `claude_code.*` OTel events |
| _Your tool here_ | [Add a provider](CONTRIBUTING.md#adding-a-new-ai-toolprovider) | Plug & play architecture |

## Privacy

- All data is stored locally in `.eyes4ai/private/`
- Raw prompts are never stored — only hashed fingerprints and short previews
- Sensitive attributes (emails, account IDs) are redacted
- No network calls except localhost OTel ingestion

## Docs

Full documentation: [selcukcihan.github.io/eyes4ai](https://selcukcihan.github.io/eyes4ai)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and how to add new AI tool providers.

## License

MIT
