---
title: Report Format
description: Understanding the eyes4ai report output.
---

The `eyes4ai report` command produces a summary of AI activity and its relationship to committed code. This page explains each section.

## AI activity

```
AI activity
  Sessions:              8  (codex: 5, claude: 3)
  Turns:                 42 (codex: 28, claude: 14)
  AI-active days:        5 / 7
  Estimated cost:        $12.84  (codex: $7.44, claude: $5.40)
```

- **Sessions** — unique AI coding sessions in the period. A session starts when you open an AI tool and ends when you close it or it times out.
- **Turns** — number of user prompts submitted across all sessions.
- **AI-active days** — days with at least one significant AI event.
- **Estimated cost** — token-based cost estimate using published API pricing. For Codex, credit costs are also tracked.

When multiple tools are used, per-tool breakdowns appear inline.

## Committed output

```
Committed output
  AI-linked commits:     11
  Files committed:       37
  Lines changed:         +1,420 / -510
```

- **AI-linked commits** — commits that had at least one AI session active within 2 hours before the commit.
- **Files committed** — total files touched across AI-linked commits.
- **Lines changed** — lines added and deleted across AI-linked commits.

## Yield

```
Yield
  Session-to-commit rate: 61%
  Avg turns per commit:   3.8
  Avg cost per commit:    $1.17
  Abandoned sessions:     3
```

- **Session-to-commit rate** — percentage of AI-linked commits relative to total sessions. Higher means more sessions result in committed code.
- **Avg turns per commit** — average number of user prompts per AI-linked commit. Lower may indicate more efficient prompting.
- **Avg cost per commit** — average estimated cost per AI-linked commit.
- **Abandoned sessions** — sessions that weren't linked to any commit. Not necessarily bad — exploratory sessions, code reviews, and learning sessions don't produce commits.

## Trend

```
Trend
  Previous period:       48% yield, $1.64 / commit
  This period:           61% yield, $1.17 / commit
```

Compares the current period with the previous period of the same length. Only appears when there's data in both periods.

## JSON output

Use `--json` for machine-readable output:

```bash
eyes4ai report --json
```

The JSON includes all the same data plus the `byTool` breakdown as a structured object.
