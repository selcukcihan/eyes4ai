import type { EyesEvent, OtlpLogRecord } from "../../schema/src/index.js";
import { attributesToRecord, coerceRecordPrimitives, logRecordTimestamp, anyValueToPrimitive, makeEventId } from "./otel.js";
import { normalizeClaudeAttributes } from "./normalize-claude.js";

/**
 * A provider normalizer takes flattened attributes, a timestamp, and a body,
 * and returns an EyesEvent or null.
 */
type ProviderNormalizer = (
  attributes: Record<string, unknown>,
  timestamp: string,
  body: unknown,
) => EyesEvent | null;

interface Provider {
  /** Return true if this provider can handle the given attributes. */
  detect: (attributes: Record<string, unknown>) => boolean;
  /** Normalize the OTel record into an EyesEvent. */
  normalize: ProviderNormalizer;
}

// Lazy-import Codex normalizer to avoid circular deps.
// normalize.ts exports normalizeFromParts which we'll use.
// For now, we import the full-record normalizer and adapt.
import { normalizeCodexLogRecord } from "./normalize.js";

/**
 * Detect Codex: event names start with "codex." or service.name contains "codex".
 */
function isCodex(attributes: Record<string, unknown>): boolean {
  const eventName = attributes["event.name"];
  if (typeof eventName === "string" && eventName.startsWith("codex.")) return true;
  const serviceName = attributes["service.name"];
  if (typeof serviceName === "string" && serviceName.toLowerCase().includes("codex")) return true;
  // Codex also uses conversation.id for session tracking
  if (typeof attributes["conversation.id"] === "string") return true;
  return false;
}

/**
 * Detect Claude Code: event names start with "claude_code." or service.name is "claude-code".
 */
function isClaude(attributes: Record<string, unknown>): boolean {
  const eventName = attributes["event.name"];
  if (typeof eventName === "string" && eventName.startsWith("claude_code.")) return true;
  const serviceName = attributes["service.name"];
  if (typeof serviceName === "string" && serviceName.toLowerCase().includes("claude")) return true;
  return false;
}

/**
 * Provider registry. Order matters — first match wins.
 * To add a new provider, add an entry here with detect + normalize.
 */
const PROVIDERS: Provider[] = [
  {
    detect: isClaude,
    normalize: normalizeClaudeAttributes,
  },
  // Codex is handled via its existing normalizer (operates on OtlpLogRecord directly),
  // so it's not in this dispatch list. See normalizeLogRecord below.
];

/**
 * Provider-agnostic OTel log record normalizer.
 *
 * Detects the source tool from attributes and routes to the right normalizer.
 * Falls back to Codex normalizer for backward compatibility.
 */
export function normalizeLogRecord(
  record: OtlpLogRecord,
  resourceAttributes: Record<string, unknown>,
): EyesEvent | null {
  const attributes = coerceRecordPrimitives({
    ...resourceAttributes,
    ...attributesToRecord(record.attributes),
  });
  const timestamp = logRecordTimestamp(record);
  const body = anyValueToPrimitive(record.body);

  // Try each registered provider
  for (const provider of PROVIDERS) {
    if (provider.detect(attributes)) {
      return provider.normalize(attributes, timestamp, body);
    }
  }

  // Default: Codex normalizer (backward compatible)
  return normalizeCodexLogRecord(record, resourceAttributes);
}
