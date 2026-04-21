import { writeFile, chmod, access, readFile } from "node:fs/promises";
import path from "node:path";
import { ensureDir } from "./fs-utils.js";

const HOOK_MARKER = "# eyes4ai:post-commit";

function postCommitScript(cliPath: string): string {
  return `#!/bin/sh
${HOOK_MARKER}
# Record this commit in the eyes4ai event log.
# This hook is non-blocking: failures are silently ignored.
node --import tsx "${cliPath}" record-commit 2>/dev/null &
`;
}

/**
 * Install a post-commit git hook that records commits as eyes4ai events.
 * If a post-commit hook already exists, appends the eyes4ai snippet.
 */
export async function installGitHook(rootDir: string): Promise<string> {
  const hooksDir = path.join(rootDir, ".git", "hooks");
  await ensureDir(hooksDir);

  const hookPath = path.join(hooksDir, "post-commit");
  const cliPath = path.join(rootDir, "apps", "cli", "src", "cli.ts");

  let exists = false;
  try {
    await access(hookPath);
    exists = true;
  } catch {
    exists = false;
  }

  if (exists) {
    const current = await readFile(hookPath, "utf8");
    if (current.includes(HOOK_MARKER)) {
      return hookPath; // already installed
    }
    // Append to existing hook
    await writeFile(hookPath, `${current.trimEnd()}\n\n${postCommitScript(cliPath)}`, "utf8");
  } else {
    await writeFile(hookPath, postCommitScript(cliPath), "utf8");
  }

  await chmod(hookPath, 0o755);
  return hookPath;
}
