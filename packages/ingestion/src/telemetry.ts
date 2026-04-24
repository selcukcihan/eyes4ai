/**
 * Anonymous usage telemetry for eyes4ai, powered by PostHog.
 *
 * Sends lightweight, anonymous events (install, report, serve, error) to help
 * track adoption and catch bugs. No PII is collected — just event type, OS,
 * Node version, and eyes4ai version.
 *
 * Disabled by setting EYES4AI_NO_TELEMETRY=1 or passing --no-telemetry.
 * All telemetry is fire-and-forget: failures are silently ignored.
 */

import os from "node:os";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PostHog } from "posthog-node";

const POSTHOG_API_KEY = "phc_ti3hznntggihkRG9tqhGysAXRTw8M6BuNeVXf52WXVPT";
const POSTHOG_HOST = "https://us.i.posthog.com";

let client: PostHog | null = null;
let cachedVersion: string | null = null;

function isDisabled(): boolean {
  return (
    process.env.EYES4AI_NO_TELEMETRY === "1" ||
    process.env.DO_NOT_TRACK === "1" ||
    process.argv.includes("--no-telemetry")
  );
}

function getClient(): PostHog {
  if (!client) {
    client = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      // Flush quickly — CLI commands are short-lived
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Stable anonymous ID derived from the machine's hostname + username.
 * Never sent to PostHog — only the hash is used as the distinct_id.
 */
function getAnonymousId(): string {
  const raw = `${os.hostname()}:${os.userInfo().username}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

async function getVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(__dirname, "..", "..", "..", "..", "package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as { version: string };
    cachedVersion = pkg.version;
    return cachedVersion;
  } catch {
    return "unknown";
  }
}

export interface TelemetryEvent {
  event: string;
  properties?: Record<string, string | number | boolean>;
}

/**
 * Send an anonymous telemetry event via PostHog. Fire-and-forget — never throws.
 */
export async function trackEvent(evt: TelemetryEvent): Promise<void> {
  if (isDisabled()) return;

  try {
    const version = await getVersion();
    const ph = getClient();

    ph.capture({
      distinctId: getAnonymousId(),
      event: evt.event,
      properties: {
        os: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        version,
        ...evt.properties,
      },
    });

    // Flush immediately — CLI exits shortly after
    await ph.flush();
  } catch {
    // Silently ignore — telemetry must never affect the user experience
  }
}

/**
 * Track an error event with a sanitized message (no file paths or PII).
 */
export function trackError(event: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  // Strip file paths to avoid leaking directory structure
  const sanitized = message.replace(/\/[^\s:]+/g, "<path>");
  void trackEvent({ event: `${event}_error`, properties: { error: sanitized } });
}

/**
 * Shut down the PostHog client gracefully.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (client) {
    await client.shutdown();
    client = null;
  }
}
