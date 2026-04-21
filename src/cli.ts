import path from "node:path";
import process from "node:process";
import { startServer } from "./server.js";
import { installCodexOtelConfig } from "./install.js";

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

  process.stdout.write("usage:\n");
  process.stdout.write("  eyes-for-ai serve [port]\n");
  process.stdout.write("  eyes-for-ai install [port]\n");
  process.exitCode = 1;
}

void main();
