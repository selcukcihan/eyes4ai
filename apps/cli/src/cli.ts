import path from "node:path";
import process from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import { installCodexOtelConfig, installGitHook, recordCommit, startServer, upgradeNormalizedEvent } from "../../../packages/ingestion/src/index.js";
import { generateMvpReport, generateRepoReport, renderMvpReport, renderRepoReport } from "../../../packages/reporting/src/index.js";
import type { EyesEvent } from "../../../packages/schema/src/index.js";

function rootDirFromCwd(): string {
  return process.cwd();
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;
  const rootDir = rootDirFromCwd();

  if (command === "serve") {
    const portArg = rest[0];
    const port = portArg ? Number(portArg) : 4318;
    const server = startServer(rootDir, port);
    process.stdout.write(`eyes4ai server listening on http://127.0.0.1:${port}\n`);
    process.stdout.write(`writing events to ${path.join(rootDir, ".eyes4ai", "private", "events")}\n`);
    process.on("SIGINT", () => {
      server.close(() => process.exit(0));
    });
    return;
  }

  if (command === "install") {
    const portArg = rest[0];
    const port = portArg ? Number(portArg) : 4318;
    const endpoint = `http://127.0.0.1:${port}`;
    const configPath = await installCodexOtelConfig(rootDir, endpoint);
    process.stdout.write(`updated ${configPath}\n`);
    process.stdout.write(`configure Codex to export OTLP/HTTP JSON logs to ${endpoint}/v1/logs\n`);
    const hookPath = await installGitHook(rootDir);
    process.stdout.write(`installed post-commit hook: ${hookPath}\n`);
    return;
  }

  if (command === "record-commit") {
    const commitHash = rest[0];
    const event = await recordCommit(rootDir, commitHash || undefined);
    const data = event.data as Record<string, unknown>;
    const sessions = data.relatedAiSessions as string[];
    process.stdout.write(`recorded commit ${(data.commit as string).slice(0, 8)} (${sessions.length} AI session(s) linked)\n`);
    return;
  }

  if (command === "reprocess") {
    const target = rest[0] ?? path.join(rootDir, ".eyes4ai", "private", "events", `${new Date().toISOString().slice(0, 10)}.jsonl`);
    const content = await readFile(target, "utf8");
    const upgraded = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as EyesEvent)
      .map((event) => upgradeNormalizedEvent(event));
    await writeFile(target, `${upgraded.map((event) => JSON.stringify(event)).join("\n")}\n`, "utf8");
    process.stdout.write(`reprocessed ${target} (${upgraded.length} events)\n`);
    return;
  }

  if (command === "report") {
    // Parse --days N and --json flags
    let days = 7;
    let jsonOutput = false;
    let legacyFormat = false;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--days" && rest[i + 1]) {
        days = Number(rest[i + 1]);
        i++;
      } else if (rest[i] === "--json") {
        jsonOutput = true;
      } else if (rest[i] === "--legacy") {
        legacyFormat = true;
      }
    }

    if (legacyFormat) {
      const report = await generateRepoReport(rootDir);
      if (jsonOutput) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      } else {
        process.stdout.write(`${renderRepoReport(report)}\n`);
      }
      return;
    }

    const report = await generateMvpReport(rootDir, days);
    if (jsonOutput) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`${renderMvpReport(report)}\n`);
    }
    return;
  }

  process.stdout.write("usage:\n");
  process.stdout.write("  eyes4ai serve [port]\n");
  process.stdout.write("  eyes4ai install [port]\n");
  process.stdout.write("  eyes4ai reprocess [file]\n");
  process.stdout.write("  eyes4ai record-commit [hash]\n");
  process.stdout.write("  eyes4ai report [--days N] [--json]\n");
  process.exitCode = 1;
}

void main();
