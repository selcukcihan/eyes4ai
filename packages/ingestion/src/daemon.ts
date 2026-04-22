import { writeFile, chmod, access, readFile, unlink, mkdir } from "node:fs/promises";
import { execFile, execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { ensureDir } from "./fs-utils.js";

const LABEL = "com.eyes4ai.server";

function exec(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err, stdout, stderr) => {
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
 * Find the globally-installed eyes4ai CLI path.
 * Returns [program] to invoke the CLI.
 */
function resolveCliCommand(): string[] {
  try {
    const globalBin = execFileSync("which", ["eyes4ai"], { encoding: "utf8" }).trim();
    if (globalBin) return [globalBin];
  } catch {
    // not found via which
  }

  // Fallback: use the current process to locate the CLI
  throw new Error("eyes4ai not found. Install globally first: npm install -g @eyes4ai/cli");
}

// ── macOS launchd ─────────────────────────────────────────────────────

function launchdPlist(cliCommand: string[], port: number, logDir: string): string {
  const args = [...cliCommand, "serve", String(port)]
    .map((a) => `    <string>${a}</string>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${path.join(logDir, "eyes4ai.stdout.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(logDir, "eyes4ai.stderr.log")}</string>
  <key>WorkingDirectory</key>
  <string>${os.homedir()}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
</dict>
</plist>
`;
}

function launchdPlistPath(): string {
  return path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
}

async function installLaunchd(port: number): Promise<string> {
  const plistPath = launchdPlistPath();
  const logDir = path.join(os.homedir(), ".eyes4ai", "logs");
  await ensureDir(logDir);
  await ensureDir(path.dirname(plistPath));

  const cliCommand = resolveCliCommand();

  // Unload existing service if present
  if (await fileExists(plistPath)) {
    await exec("launchctl", ["unload", plistPath]).catch(() => {});
  }

  await writeFile(plistPath, launchdPlist(cliCommand, port, logDir), "utf8");
  await exec("launchctl", ["load", plistPath]);

  return plistPath;
}

async function uninstallLaunchd(): Promise<boolean> {
  const plistPath = launchdPlistPath();
  if (!(await fileExists(plistPath))) return false;
  await exec("launchctl", ["unload", plistPath]).catch(() => {});
  await unlink(plistPath);
  return true;
}

// ── Linux systemd ─────────────────────────────────────────────────────

function systemdUnit(cliCommand: string[], port: number): string {
  const execStart = [...cliCommand, "serve", String(port)].join(" ");
  return `[Unit]
Description=eyes4ai OTel ingestion server
After=network.target

[Service]
Type=simple
ExecStart=${execStart}
Restart=on-failure
RestartSec=5
WorkingDirectory=${os.homedir()}
Environment=PATH=/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
`;
}

function systemdUnitPath(): string {
  return path.join(os.homedir(), ".config", "systemd", "user", `${LABEL}.service`);
}

async function installSystemd(port: number): Promise<string> {
  const unitPath = systemdUnitPath();
  await ensureDir(path.dirname(unitPath));

  const cliCommand = resolveCliCommand();

  await writeFile(unitPath, systemdUnit(cliCommand, port), "utf8");
  await exec("systemctl", ["--user", "daemon-reload"]);
  await exec("systemctl", ["--user", "enable", LABEL]);
  await exec("systemctl", ["--user", "start", LABEL]);

  return unitPath;
}

async function uninstallSystemd(): Promise<boolean> {
  const unitPath = systemdUnitPath();
  if (!(await fileExists(unitPath))) return false;
  await exec("systemctl", ["--user", "stop", LABEL]).catch(() => {});
  await exec("systemctl", ["--user", "disable", LABEL]).catch(() => {});
  await unlink(unitPath);
  await exec("systemctl", ["--user", "daemon-reload"]).catch(() => {});
  return true;
}

// ── Public API ────────────────────────────────────────────────────────

export type DaemonPlatform = "launchd" | "systemd" | "unsupported";

export function detectPlatform(): DaemonPlatform {
  const platform = os.platform();
  if (platform === "darwin") return "launchd";
  if (platform === "linux") return "systemd";
  return "unsupported";
}

export interface DaemonInstallResult {
  platform: DaemonPlatform;
  configPath: string;
}

/**
 * Install the eyes4ai server as a background daemon that starts on boot.
 * macOS: launchd plist in ~/Library/LaunchAgents/
 * Linux: systemd user service in ~/.config/systemd/user/
 */
export async function installDaemon(port: number): Promise<DaemonInstallResult> {
  const platform = detectPlatform();

  if (platform === "launchd") {
    const configPath = await installLaunchd(port);
    return { platform, configPath };
  }

  if (platform === "systemd") {
    const configPath = await installSystemd(port);
    return { platform, configPath };
  }

  throw new Error(`Unsupported platform: ${os.platform()}. Start the server manually with: eyes4ai serve`);
}

/**
 * Uninstall the daemon. Returns true if a daemon was found and removed.
 */
export async function uninstallDaemon(): Promise<boolean> {
  const platform = detectPlatform();
  if (platform === "launchd") return uninstallLaunchd();
  if (platform === "systemd") return uninstallSystemd();
  return false;
}
