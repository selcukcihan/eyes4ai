---
title: Quick Start
description: Get eyes4ai running in under a minute.
---

## 1. Install and set up

```bash
npm install -g @eyes4ai/cli
eyes4ai install --global
```

That's it. This configures Codex and Claude Code to send telemetry, installs a Git commit hook, and starts a background server that persists across reboots.

## 2. Use your AI tools normally

Open Codex or Claude Code in any repo and work as usual. eyes4ai captures activity silently via OpenTelemetry.

## 3. Make some commits

Commit your work with Git as normal. The post-commit hook automatically records each commit and links it to recent AI sessions.

## 4. View your report

```bash
cd /path/to/your/repo
eyes4ai report
```

Output:

```
Period: last 7 days

AI activity
  Sessions:                   8  (codex: 5, claude: 3)
  Turns:                      42 (codex: 28, claude: 14)
  AI-active days:             5 / 7
  Estimated cost:             $12.84  (codex: $7.44, claude: $5.40)

Committed output
  AI-linked commits:          11
  Files committed:            37
  Lines changed:              +1,420 / -510

Yield
  Session-to-commit rate:     61%
  Avg turns per commit:       3.8
  Avg cost per commit:        $1.17
  Abandoned sessions:         3

Trend
  Previous period:            48% yield, $1.64 / commit
  This period:                61% yield, $1.17 / commit
```

## JSON output

For programmatic consumption:

```bash
eyes4ai report --json
```

## Custom period

Default is 7 days. For a different window:

```bash
eyes4ai report --days 30
```
