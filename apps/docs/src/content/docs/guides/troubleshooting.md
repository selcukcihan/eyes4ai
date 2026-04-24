---
title: Troubleshooting
description: Common issues and how to fix them.
---

## No events being recorded

**Symptom:** You used Codex or Claude Code but `~/.eyes4ai/private/events/` is empty or unchanged.

**Checklist:**

1. **Did you run `eyes4ai install --global`?** Installing the npm package only puts the binary on your PATH. You must run `eyes4ai install --global` to configure your AI tools, set up git hooks, and start the daemon.

2. **Did you restart your AI tool after install?** Codex and Claude Code only read their config at startup. If they were already running when you ran `eyes4ai install`, they won't emit telemetry until restarted. Quit and reopen the tool.

3. **Is the daemon running?**
   ```bash
   curl http://127.0.0.1:4318/health
   ```
   You should see `{"ok":true,...}`. If not, start it manually:
   ```bash
   eyes4ai serve
   ```

4. **Does the config exist?**
   - Codex: `cat ~/.codex/config.toml` — look for the `[otel]` block between `# eyes4ai:begin` and `# eyes4ai:end`
   - Claude Code: `cat ~/.claude/settings.json` — look for `OTEL_EXPORTER_OTLP_ENDPOINT` in the `env` key

## Commits not being linked to AI sessions

**Symptom:** The report shows AI activity but zero AI-linked commits.

1. **Is the git hook installed?**
   ```bash
   git config --global core.hooksPath
   ```
   Should return `~/.eyes4ai/hooks` (or similar). Check the hook exists:
   ```bash
   ls -la ~/.eyes4ai/hooks/post-commit
   ```

2. **Is the hook executable?**
   ```bash
   chmod +x ~/.eyes4ai/hooks/post-commit
   ```

## Existing git hooks stopped working

**Symptom:** After installing eyes4ai, your Husky, Lefthook, or custom post-commit hooks no longer run.

1. **Are you using global mode?** The global hook (`~/.eyes4ai/hooks/post-commit`) automatically chains to Husky (v4 and v9+), Lefthook, and plain `.git/hooks/post-commit`. If your hook manager isn't detected, please [open an issue](https://github.com/selcukcihan/eyes4ai/issues).

2. **Are you using per-repo mode?** Per-repo install appends the eyes4ai snippet to your existing `.git/hooks/post-commit`. Check that the file still has your original hook content above the `# eyes4ai:post-commit` marker:
   ```bash
   cat .git/hooks/post-commit
   ```

3. **Reinstall the hook** if it got corrupted:
   ```bash
   eyes4ai install        # per-repo
   eyes4ai install --global  # global
   ```

## Daemon won't start on boot

**macOS:** Check the launchd plist:
```bash
cat ~/Library/LaunchAgents/com.eyes4ai.server.plist
```
Reload it:
```bash
launchctl unload ~/Library/LaunchAgents/com.eyes4ai.server.plist
launchctl load ~/Library/LaunchAgents/com.eyes4ai.server.plist
```

**Linux:** Check the systemd service:
```bash
systemctl --user status com.eyes4ai.server
journalctl --user -u com.eyes4ai.server
```

## Port conflict

If port 4318 is already in use, install with a custom port:
```bash
eyes4ai install --global 4319
```

## Checking daemon logs

```bash
cat ~/.eyes4ai/logs/eyes4ai.stdout.log
cat ~/.eyes4ai/logs/eyes4ai.stderr.log
```

## Reinstalling from scratch

```bash
eyes4ai uninstall
npm uninstall -g @eyes4ai/cli
npm install -g @eyes4ai/cli
eyes4ai install --global
```

Then restart any running Codex or Claude Code sessions.
