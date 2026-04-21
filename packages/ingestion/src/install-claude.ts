import { writeFile, access, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ensureDir } from "./fs-utils.js";

/**
 * The env vars Claude Code needs to export OTel logs to our server.
 */
function otelEnvVars(endpoint: string): Record<string, string> {
  return {
    CLAUDE_CODE_ENABLE_TELEMETRY: "1",
    OTEL_LOGS_EXPORTER: "otlp",
    OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
  };
}

/**
 * Merge eyes4ai OTel env vars into a Claude Code settings.json file.
 * Preserves existing settings; only touches the "env" key.
 */
async function upsertClaudeSettings(settingsPath: string, endpoint: string): Promise<void> {
  await ensureDir(path.dirname(settingsPath));

  let settings: Record<string, unknown> = {};
  try {
    await access(settingsPath);
    const content = await readFile(settingsPath, "utf8");
    settings = JSON.parse(content) as Record<string, unknown>;
  } catch {
    // File doesn't exist or isn't valid JSON — start fresh
  }

  const existingEnv = (typeof settings.env === "object" && settings.env !== null && !Array.isArray(settings.env))
    ? settings.env as Record<string, unknown>
    : {};

  settings.env = {
    ...existingEnv,
    ...otelEnvVars(endpoint),
  };

  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

/** Install Claude Code OTel config into the repo-local .claude/settings.json. */
export async function installClaudeOtelConfig(rootDir: string, endpoint: string): Promise<string> {
  const settingsPath = path.join(rootDir, ".claude", "settings.json");
  await upsertClaudeSettings(settingsPath, endpoint);
  return settingsPath;
}

/** Install Claude Code OTel config into the global ~/.claude/settings.json. */
export async function installClaudeOtelConfigGlobal(endpoint: string): Promise<string> {
  const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
  await upsertClaudeSettings(settingsPath, endpoint);
  return settingsPath;
}
