# Idea

A git recorded standard way of keeping track of AI usage.
For example, I always add an AGENTS.md file in my project and in it there's a prompt that says after each iteration make sure to log the prompt in a file.
This is very basic though. I envision something like a ".eyes4ai" folder which will contain not just prompts entered but also the token usage per prompt, latency, git commit hash if committed and other things that I can't think of now but maybe you can help me out.

# AI Response to the Idea

100% agreed. The CLI should not be the workflow. At most it should be an **installer/debugger**.

The write path should be:

> user works normally → agent hook records events → Git hook correlates them with commits → `.eyes4ai` gets updated silently

So the architecture becomes:

```text
AI agent hooks  --->  .eyes4ai/events/*.jsonl  --->  Git hooks  --->  commit/session manifest
       |                                             |
       captures prompt/tool usage                    attaches repo/commit context
```

## The key shift

Your product should not say:

```bash
ai-ledger start
ai-ledger prompt
ai-ledger commit
```

It should say:

```bash
ai-ledger install
```

And then disappear.

Actually, even the install command could later be replaced by package-manager integrations, editor extensions, or repo templates. But practically, one-time install is fine. The daily path must be zero ceremony.

## Best write-path design

I’d split it into **two hook layers**.

### 1. Agent hooks: capture AI activity

This is where prompts, tool calls, latency, model name, token usage, and output metadata should come from.

Modern agent tools are already moving in this direction. Codex has lifecycle hooks such as `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, and `Stop`, and its docs explicitly mention use cases like sending conversations to logging/analytics and scanning prompts for secrets. The docs also say repo-local hooks can live in `<repo>/.codex/hooks.json`. ([OpenAI Developers][1])

Claude Code has a similar hook concept: hooks can run automatically at specific lifecycle points, receive JSON context, and can be implemented as shell commands or HTTP endpoints. Its docs mention events such as `UserPromptSubmit`, `SessionStart`, and tool-related hooks. ([Claude][2])

So the agent hook writes events like:

```json
{"type":"ai.prompt","session_id":"s1","timestamp":"...","prompt_hash":"...","prompt_preview":"Refactor auth middleware..."}
{"type":"ai.tool_call","session_id":"s1","tool":"edit_file","path":"src/auth.ts"}
{"type":"ai.usage","session_id":"s1","model":"gpt-5.4-thinking","input_tokens":12400,"output_tokens":2100,"latency_ms":8300}
{"type":"ai.stop","session_id":"s1"}
```

This should be append-only and dumb.

No user action.

### 2. Git hooks: capture repo state

Git hooks are still useful, but for a different job. Git’s own docs define hooks as programs that run at points in Git’s execution, including hooks like `pre-commit`; Git also supports configuring the hooks directory via `core.hooksPath`. ([Git SCM][3])

The Git hooks should capture:

```json
{
  "commit": "abc123",
  "branch": "feature/login",
  "files_changed": ["src/auth.ts", "test/auth.test.ts"],
  "lines_added": 121,
  "lines_deleted": 48,
  "nearest_ai_sessions": ["s1", "s2"],
  "ai_assisted": true
}
```

But Git hooks should **not** be responsible for knowing prompts. They cannot know that reliably.

Git hooks are the commit correlator.

Agent hooks are the AI recorder.

## The product model

I’d describe the system as:

> **A passive AI activity recorder for Git repositories.**

Not:

> “A CLI for tracking AI usage.”

The CLI is just the installer.

## The invisible install

Something like:

```bash
npx ai-ledger install
```

does three things:

```text
1. Creates .eyes4ai/
2. Adds repo-local Git hooks via core.hooksPath
3. Installs agent-specific hook configs when it detects Codex, Claude Code, Cursor, etc.
```

Example structure:

```text
.eyes4ai/
  config.yaml
  events/
    2026-04-21.jsonl
  commits/
    abc123.json
  private/
    raw-prompts.jsonl
.githooks/
  pre-commit
  post-commit
.codex/
  hooks.json
.claude/
  settings.local.json
```

The user still uses Codex, Claude Code, Cursor, Git, VS Code, whatever. Your thing just listens.

## Important: avoid slowing down commits

The Git hooks should be **non-blocking by default**.

I would avoid doing heavy work in `pre-commit`. Developers already hate slow pre-commit hooks. The hook should do the absolute minimum:

```text
pre-commit:
  - snapshot current staged diff metadata
  - associate with active/recent AI sessions
  - optionally stage .eyes4ai manifest if configured

post-commit:
  - write final commit hash
  - update local ledger
```

For teams that want strict policy, they can enable blocking mode later:

```yaml
policy:
  require_ai_manifest_for_ai_commits: true
  block_secret_leaks_in_prompts: true
  require_tests_for_security_sensitive_ai_changes: true
```

But default mode should be passive.

The default personality of the tool should be:

> “I observe. I do not interrupt.”

## The hard problem: committing `.eyes4ai` metadata

There is a subtle Git problem here.

If a `post-commit` hook writes `.eyes4ai/commits/abc123.json`, that file is **not inside the commit that was just created**. It becomes an unstaged change after the commit.

That is annoying.

So you have a few options.

### Option A: local ledger by default

Store detailed activity locally, not committed:

```text
.git/ai-ledger/
```

or:

```text
.eyes4ai/private/
```

Then only committed code changes go into Git. This is the lowest-friction default.

### Option B: pre-commit stages the manifest

The `pre-commit` hook writes a pending manifest before the commit is created:

```text
.eyes4ai/commits/pending.json
```

Then stages it automatically.

After commit, `post-commit` renames or updates it with the final hash. But that creates another change unless you amend the commit, which is gross.

So this is tricky.

### Option C: use commit trailers

The Git hook adds a small trailer to the commit message:

```text
AI-Assisted: true
AI-Sessions: s1,s2
```

Then the full metadata can live elsewhere. This is simple, portable, and low-friction, but slightly visible.

### Option D: use Git notes

Git notes are actually a nice fit:

```bash
git notes add -m "AI-Sessions: s1,s2"
```

The commit object stays untouched. The metadata is attached externally.

Downside: Git notes are less commonly understood and need their ref pushed/fetched intentionally.

### My pick

Default:

```text
local detailed ledger + optional commit trailer
```

Team/compliance mode:

```text
committed redacted .eyes4ai summaries
```

I would not force every repo to commit full `.eyes4ai` logs. That will scare people.

## Better folder design

I’d now change the earlier folder structure to this:

```text
.eyes4ai/
  config.yaml

  public/
    README.md
    summaries/
      2026-04-21.jsonl

  private/
    events/
      2026-04-21.jsonl
    raw/
      prompts.jsonl
      responses.jsonl

  state/
    active-session
    recent-sessions.json
```

Then `.gitignore` defaults to:

```gitignore
.eyes4ai/private/
.eyes4ai/state/
```

Committed by default:

```text
.eyes4ai/config.yaml
.eyes4ai/public/summaries/*.jsonl
```

Not committed:

```text
raw prompts
raw responses
full tool traces
temporary state
```

## Hook flow

A realistic flow:

```text
User opens Codex/Claude/Cursor
        ↓
Agent SessionStart hook creates session id
        ↓
User submits prompt
        ↓
UserPromptSubmit hook logs prompt hash + redacted preview
        ↓
Agent edits files
        ↓
PostToolUse hook logs file writes, commands, tests
        ↓
User runs git commit normally
        ↓
pre-commit hook checks recent AI sessions + changed files
        ↓
commit-msg hook optionally adds trailer
        ↓
post-commit hook writes commit correlation locally
```

The user never calls your tool manually.

## Agent adapters, not one universal agent

The real product probably needs adapters:

```text
.eyes4ai/adapters/
  codex.json
  claude-code.json
  cursor.json
  copilot.json
  aider.json
```

Each adapter maps the native agent event format into your standard event format.

Internally:

```text
Codex UserPromptSubmit  -> ai.prompt
Claude UserPromptSubmit -> ai.prompt
Cursor hook event       -> ai.prompt
Git pre-commit          -> git.pre_commit
Git post-commit         -> git.post_commit
```

Your standard is the normalized schema, not the capture mechanism.

That is the right abstraction.

## The smallest MVP

I would start with only:

```text
1. Codex hook adapter
2. Claude Code hook adapter
3. Git post-commit/pre-commit correlator
4. Local JSONL event log
5. One generated summary command for debugging
```

No dashboard. No SaaS. No complex reports.

The MVP promise:

> “Install once. Keep using your AI coding tools normally. Your repo now has a passive AI activity ledger.”

## What gets recorded invisibly

Good default event schema:

```json
{
  "schema": "ai-ledger.event.v1",
  "event_id": "evt_...",
  "session_id": "sess_...",
  "timestamp": "2026-04-21T12:10:00Z",
  "source": {
    "kind": "agent_hook",
    "tool": "codex"
  },
  "type": "ai.prompt",
  "data": {
    "prompt_hash": "sha256...",
    "prompt_preview": "Refactor login flow to support refresh tokens...",
    "raw_prompt_stored": false
  }
}
```

For Git:

```json
{
  "schema": "ai-ledger.event.v1",
  "event_id": "evt_...",
  "timestamp": "2026-04-21T12:24:00Z",
  "source": {
    "kind": "git_hook",
    "hook": "post-commit"
  },
  "type": "git.commit",
  "data": {
    "commit": "abc123",
    "branch": "feature/login",
    "files_changed": ["src/auth.ts"],
    "related_ai_sessions": ["sess_..."]
  }
}
```

## The most important config

This should be the heart of the product:

```yaml
capture:
  prompts: redacted_preview
  raw_prompts: local_only
  responses: metadata_only
  tool_calls: true
  token_usage: true
  latency: true
  file_changes: true
  git_commits: true

privacy:
  default_commit_mode: public_summary_only
  redact_secrets: true

git:
  add_commit_trailer: ask_once
  use_git_notes: false
  block_commit_on_error: false
```

Default should be privacy-preserving and non-blocking.

## The sharp product insight

The “standard” is not a CLI.

The standard is:

```text
.eyes4ai/events/*.jsonl
.eyes4ai/config.yaml
.eyes4ai/public/summaries/*.jsonl
```

And a simple rule:

> Any AI coding tool may write append-only events into `.eyes4ai/events/` using the standard schema.

That lets other tools participate without adopting your CLI.

So the write-path architecture becomes:

```text
Native agent hook/plugin/extension
        ↓
Append event to .eyes4ai event log
        ↓
Git hook correlates event log with commits
        ↓
Optional summary committed or attached
```

That feels much more viable. It’s a passive recorder, not yet another command developers must remember to run.

[1]: https://developers.openai.com/codex/hooks "Hooks – Codex | OpenAI Developers"
[2]: https://code.claude.com/docs/en/hooks?utm_source=chatgpt.com "Hooks reference - Claude Code Docs"
[3]: https://git-scm.com/docs/githooks "Git - githooks Documentation"
