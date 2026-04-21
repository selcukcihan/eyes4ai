import path from "node:path";
import process from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import { installCodexOtelConfig, startServer, upgradeNormalizedEvent } from "../../../packages/ingestion/src/index.js";
import { generateRepoReport, renderRepoReport } from "../../../packages/reporting/src/index.js";
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
    process.stdout.write(`eyes-for-ai server listening on http://127.0.0.1:${port}\n`);
    process.stdout.write(`writing events to ${path.join(rootDir, ".ai", "private", "events")}\n`);
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
    return;
  }

  if (command === "reprocess") {
    const target = rest[0] ?? path.join(rootDir, ".ai", "private", "events", `${new Date().toISOString().slice(0, 10)}.jsonl`);
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
    const report = await generateRepoReport(rootDir);
    if (rest[0] === "--json") {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${renderRepoReport(report)}\n`);
    return;
  }

  process.stdout.write("usage:\n");
  process.stdout.write("  eyes-for-ai serve [port]\n");
  process.stdout.write("  eyes-for-ai install [port]\n");
  process.stdout.write("  eyes-for-ai reprocess [file]\n");
  process.stdout.write("  eyes-for-ai report [--json]\n");
  process.exitCode = 1;
}

void main();
