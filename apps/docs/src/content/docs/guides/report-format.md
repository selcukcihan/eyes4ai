---
title: Report Format
description: Understanding the eyes4ai report output.
---

The `eyes4ai report` command produces a summary of AI activity and its relationship to committed code. This page explains each metric.

## Sample output

```
Period: last 7 days

  Sessions:              8  (codex: 5, claude: 3)
  Turns:                 42 (codex: 28, claude: 14)
  AI-active days:        5 / 7
  Estimated cost:        $12.84  (codex: $7.44, claude: $5.40)
  AI-linked commits:     11 / 18 (61%)
  Avg cost per commit:   $1.17

  Previous period cost:  $9.50
  Previous AI commits:   7 / 15 (47%)
```

## Metrics

- **Sessions** — unique AI coding sessions in the period. A session starts when you open an AI tool and ends when you close it or it times out.
- **Turns** — number of user prompts submitted across all sessions.
- **AI-active days** — days with at least one significant AI event.
- **Estimated cost** — token-based cost estimate using published API pricing.
- **AI-linked commits** — commits that had at least one AI session active within 2 hours before the commit, shown as a fraction of total commits with percentage.
- **Avg cost per commit** — average estimated cost per AI-linked commit.

When multiple tools are used, per-tool breakdowns appear inline.

When data exists for the previous period of the same length, previous period cost and AI commit percentage are shown for comparison.

## JSON output

Use `--json` for machine-readable output:

```bash
eyes4ai report --json
```

The JSON includes all the same data plus the `byTool` breakdown as a structured object.
