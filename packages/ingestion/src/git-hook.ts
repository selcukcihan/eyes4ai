import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { EyesEvent, GitCommitData } from "../../schema/src/index.js";
import { appendJsonLine, todayJsonlPath } from "./fs-utils.js";

function exec(cmd: string, args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

interface CommitMeta {
  commit: string;
  branch: string;
  filesChanged: string[];
  linesAdded: number;
  linesDeleted: number;
  timestamp: string;
}

async function getCommitMeta(repoPath: string, commitHash?: string): Promise<CommitMeta> {
  const hash = commitHash ?? await exec("git", ["rev-parse", "HEAD"], repoPath);
  const branch = await exec("git", ["rev-parse", "--abbrev-ref", "HEAD"], repoPath).catch(() => "unknown");
  const timestamp = await exec("git", ["show", "-s", "--format=%aI", hash], repoPath);

  // Get files changed and line stats
  const diffStat = await exec("git", ["diff-tree", "--no-commit-id", "--numstat", "-r", hash], repoPath);
  const filesChanged: string[] = [];
  let linesAdded = 0;
  let linesDeleted = 0;

  for (const line of diffStat.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length >= 3) {
      const added = parseInt(parts[0]!, 10);
      const deleted = parseInt(parts[1]!, 10);
      if (!Number.isNaN(added)) linesAdded += added;
      if (!Number.isNaN(deleted)) linesDeleted += deleted;
      filesChanged.push(parts[2]!);
    }
  }

  return { commit: hash, branch, filesChanged, linesAdded, linesDeleted, timestamp };
}

/**
 * Find AI sessions that were active near the commit time.
 * Looks at events from today and yesterday, finds sessions with activity
 * within a configurable window (default 2 hours) before the commit.
 */
async function findRelatedSessions(
  repoPath: string,
  commitTimestamp: string,
  windowMs: number = 2 * 60 * 60 * 1000,
): Promise<string[]> {
  const eventsDir = path.join(repoPath, ".eyes4ai", "private", "events");
  let files: string[];
  try {
    files = (await readdir(eventsDir)).filter((f) => f.endsWith(".jsonl")).sort();
  } catch {
    return [];
  }

  const commitTime = Date.parse(commitTimestamp);
  if (Number.isNaN(commitTime)) return [];

  // Only look at recent files (today and yesterday)
  const today = new Date(commitTime).toISOString().slice(0, 10);
  const yesterday = new Date(commitTime - 86_400_000).toISOString().slice(0, 10);
  const relevantFiles = files.filter((f) => f.startsWith(today) || f.startsWith(yesterday));

  const sessionLastActivity = new Map<string, number>();

  for (const file of relevantFiles) {
    const content = await readFile(path.join(eventsDir, file), "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as EyesEvent;
        if (event.type === "ai.transport" || event.type === "codex.raw") continue;
        const ts = Date.parse(event.timestamp);
        if (Number.isNaN(ts) || event.timestamp.startsWith("1970")) continue;
        const existing = sessionLastActivity.get(event.sessionId) ?? 0;
        if (ts > existing) {
          sessionLastActivity.set(event.sessionId, ts);
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  // Sessions active within the window before the commit
  const related: string[] = [];
  for (const [sessionId, lastTs] of sessionLastActivity) {
    const diff = commitTime - lastTs;
    if (diff >= 0 && diff <= windowMs) {
      related.push(sessionId);
    }
  }

  return related;
}

/**
 * Record a git commit as an eyes4ai event.
 * Called from the post-commit hook.
 */
export async function recordCommit(repoPath: string, commitHash?: string): Promise<EyesEvent> {
  const meta = await getCommitMeta(repoPath, commitHash);
  const relatedSessions = await findRelatedSessions(repoPath, meta.timestamp);

  const data: GitCommitData = {
    commit: meta.commit,
    branch: meta.branch,
    filesChanged: meta.filesChanged,
    linesAdded: meta.linesAdded,
    linesDeleted: meta.linesDeleted,
    relatedAiSessions: relatedSessions,
  };

  const event: EyesEvent = {
    schema: "eyes4ai.event.v1",
    eventId: crypto.randomUUID(),
    timestamp: meta.timestamp,
    sessionId: relatedSessions[0] ?? "no-session",
    source: {
      kind: "git_hook",
      surface: "git",
      event: "post-commit",
    },
    type: "git.commit",
    data,
  };

  const filePath = todayJsonlPath(repoPath);
  await appendJsonLine(filePath, event);
  return event;
}
