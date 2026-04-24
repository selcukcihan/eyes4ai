import { writeFile, chmod, access, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { ensureDir } from "./fs-utils.js";

const HOOK_MARKER = "# eyes4ai:post-commit";

function localPostCommitSnippet(): string {
  return `
${HOOK_MARKER}
# Record this commit in the eyes4ai event log.
# This hook is non-blocking: failures are silently ignored.
# Guard: skip if already recorded by the global hook.
[ "$EYES4AI_HOOKED" = "1" ] && exit 0
export EYES4AI_HOOKED=1
eyes4ai record-commit >/dev/null 2>&1 &
`;
}

/**
 * Global post-commit hook.
 * Uses the globally-installed eyes4ai binary, and chains to any
 * repo-local hook system that may exist (plain hooks, Husky, Lefthook, etc.),
 * since core.hooksPath causes git to skip .git/hooks/ entirely.
 */
function globalPostCommitScript(): string {
  return `#!/bin/sh
${HOOK_MARKER}
# eyes4ai global post-commit hook.
# Non-blocking: record-commit runs in background, failures ignored.
# Guard: skip if already recorded (prevents double-recording).
[ "$EYES4AI_HOOKED" = "1" ] && exit 0
export EYES4AI_HOOKED=1
eyes4ai record-commit >/dev/null 2>&1 &

# Chain to the repo's own post-commit hook.
# core.hooksPath overrides .git/hooks/ entirely, so we must
# re-invoke whatever the repo would have used.
GIT_DIR="$(git rev-parse --git-dir 2>/dev/null)"

# 1. Husky (v9+): .husky/post-commit
if [ -x ".husky/post-commit" ]; then
  exec .husky/post-commit
fi

# 2. Husky (v4 / legacy): .husky/hooks/post-commit
if [ -x ".husky/hooks/post-commit" ]; then
  exec .husky/hooks/post-commit
fi

# 3. Lefthook: delegates via lefthook binary
if command -v lefthook >/dev/null 2>&1 && [ -f "lefthook.yml" -o -f ".lefthook.yml" ]; then
  lefthook run post-commit
fi

# 4. Plain .git/hooks/post-commit
REPO_HOOK="$GIT_DIR/hooks/post-commit"
if [ -x "$REPO_HOOK" ]; then
  exec "$REPO_HOOK"
fi
`;
}

function exec(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Install a post-commit git hook into a single repo's .git/hooks/.
 */
export async function installGitHook(rootDir: string): Promise<string> {
  const hooksDir = path.join(rootDir, ".git", "hooks");
  await ensureDir(hooksDir);

  const hookPath = path.join(hooksDir, "post-commit");

  if (await fileExists(hookPath)) {
    const current = await readFile(hookPath, "utf8");
    if (current.includes(HOOK_MARKER)) {
      return hookPath; // already installed
    }
    // Append our snippet to the existing hook
    await writeFile(hookPath, `${current.trimEnd()}\n${localPostCommitSnippet()}`, "utf8");
  } else {
    // Create new hook with shebang + our snippet
    await writeFile(hookPath, `#!/bin/sh\n${localPostCommitSnippet()}`, "utf8");
  }

  await chmod(hookPath, 0o755);
  return hookPath;
}

/**
 * Install the post-commit hook globally via git's core.hooksPath.
 *
 * 1. Creates ~/.eyes4ai/hooks/ with a post-commit script.
 * 2. Sets git config --global core.hooksPath to that directory.
 *
 * The hook chains to repo-local .git/hooks/post-commit so existing
 * per-repo hooks keep working.
 */
export async function installGitHookGlobal(): Promise<{ hooksDir: string; hookPath: string }> {
  const hooksDir = path.join(os.homedir(), ".eyes4ai", "hooks");
  await ensureDir(hooksDir);

  const hookPath = path.join(hooksDir, "post-commit");

  if (await fileExists(hookPath)) {
    const current = await readFile(hookPath, "utf8");
    if (current.includes(HOOK_MARKER)) {
      // Already installed — just ensure core.hooksPath is set
      await exec("git", ["config", "--global", "core.hooksPath", hooksDir]);
      return { hooksDir, hookPath };
    }
    // Append to existing global hook
    await writeFile(hookPath, `${current.trimEnd()}\n\n${globalPostCommitScript()}`, "utf8");
  } else {
    await writeFile(hookPath, globalPostCommitScript(), "utf8");
  }

  await chmod(hookPath, 0o755);
  await exec("git", ["config", "--global", "core.hooksPath", hooksDir]);
  return { hooksDir, hookPath };
}
