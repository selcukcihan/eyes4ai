#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { detectPlatform, installClaudeOtelConfig, installClaudeOtelConfigGlobal, installCodexOtelConfig, installCodexOtelConfigGlobal, installDaemon, installGitHook, installGitHookGlobal, recordCommit, startServer, uninstallDaemon, upgradeNormalizedEvent } from "../../../packages/ingestion/src/index.js";
import { generateMvpReport, generateRepoReport, renderMvpReport, renderRepoReport } from "../../../packages/reporting/src/index.js";
import type { EyesEvent } from "../../../packages/schema/src/index.js";

function rootDirFromCwd(): string {
  return process.cwd();
}

async function getVersion(): Promise<string> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pkgPath = path.resolve(__dirname, "..", "..", "..", "..", "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as { version: string };
  return pkg.version;
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;
  const rootDir = rootDirFromCwd();

  if (command === "--version" || command === "-v" || command === "version") {
    const version = await getVersion();
    process.stdout.write(`${version}\n`);
    return;
  }

  if (command === "serve") {
    const portArg = rest[0];
    const port = portArg ? Number(portArg) : 4318;
    const server = startServer(rootDir, port);
    process.stdout.write(`eyes4ai server listening on http://127.0.0.1:${port}\n`);
    process.stdout.write(`dashboard: http://127.0.0.1:${port}\n`);
    process.stdout.write(`writing events to ${path.join(rootDir, ".eyes4ai", "private", "events")}\n`);
    process.on("SIGINT", () => {
      server.close(() => process.exit(0));
    });
    return;
  }

  if (command === "install") {
    const isGlobal = rest.includes("--global");
    const portArg = rest.find((a) => a !== "--global");
    const port = portArg ? Number(portArg) : 4318;
    const endpoint = `http://127.0.0.1:${port}`;

    if (isGlobal) {
      const codexPath = await installCodexOtelConfigGlobal(endpoint);
      process.stdout.write(`codex config: ${codexPath}\n`);
      const claudePath = await installClaudeOtelConfigGlobal(endpoint);
      process.stdout.write(`claude config: ${claudePath}\n`);
      const { hookPath } = await installGitHookGlobal();
      process.stdout.write(`git hook:     ${hookPath}\n`);

      // Install daemon for auto-start on boot
      const platform = detectPlatform();
      if (platform !== "unsupported") {
        try {
          const daemon = await installDaemon(port);
          process.stdout.write(`daemon:       ${daemon.configPath} (${daemon.platform})\n`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          process.stdout.write(`daemon:       failed (${msg})\n`);
          process.stdout.write(`              start manually with: eyes4ai serve\n`);
        }
      } else {
        process.stdout.write(`daemon:       unsupported platform, start manually with: eyes4ai serve\n`);
      }

      process.stdout.write(`\nAll repos will now record AI-linked commits automatically.\n`);
      process.stdout.write(`The OTel server is running and will restart on boot.\n`);
      process.stdout.write(`\nIMPORTANT: Restart any running Codex or Claude Code sessions to pick up the new config.\n`);
    } else {
      const codexPath = await installCodexOtelConfig(rootDir, endpoint);
      process.stdout.write(`codex config: ${codexPath}\n`);
      const claudePath = await installClaudeOtelConfig(rootDir, endpoint);
      process.stdout.write(`claude config: ${claudePath}\n`);
      const hookPath = await installGitHook(rootDir);
      process.stdout.write(`git hook:     ${hookPath}\n`);
      process.stdout.write(`\nIMPORTANT: Restart any running Codex or Claude Code sessions to pick up the new config.\n`);
      process.stdout.write(`Start the server manually: eyes4ai serve\n`);
    }
    return;
  }

  if (command === "uninstall") {
    const removed = await uninstallDaemon();
    if (removed) {
      process.stdout.write("stopped and removed eyes4ai daemon\n");
    } else {
      process.stdout.write("no daemon found to remove\n");
    }
    process.stdout.write("note: tool configs and git hooks are left in place. Remove manually if needed.\n");
    return;
  }

  if (command === "record-commit") {
    const commitHash = rest[0];
    await recordCommit(rootDir, commitHash || undefined);
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
  process.stdout.write("  eyes4ai install [port] [--global]   Configure AI tools, git hooks, and daemon\n");
  process.stdout.write("  eyes4ai uninstall                   Remove the background daemon\n");
  process.stdout.write("  eyes4ai serve [port]                Start the OTel ingestion server\n");
  process.stdout.write("  eyes4ai report [--days N] [--json]  Generate an AI activity report\n");
  process.stdout.write("  eyes4ai record-commit [hash]        Record a git commit\n");
  process.stdout.write("  eyes4ai reprocess [file]            Re-normalize events\n");
  process.stdout.write("  eyes4ai --version                   Show installed version\n");
  process.stdout.write("\nquick start:\n");
  process.stdout.write("  npm install -g @eyes4ai/cli\n");
  process.stdout.write("  eyes4ai install --global\n");
  process.exitCode = 1;
}

void main();
