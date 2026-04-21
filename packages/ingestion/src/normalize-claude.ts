import { estimateTokenCostUsd } from "./pricing.js";
import { makeEventId, sha256 } from "./otel.js";
import type { EyesEvent } from "../../schema/src/index.js";

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function sessionId(attributes: Record<string, unknown>): string {
  const raw = attributes["session.id"];
  return typeof raw === "string" && raw.length > 0 ? raw : "unknown-session";
}

function sanitize(attributes: Record<string, unknown>): Record<string, unknown> {
  const redacted = new Set(["user.account_id", "user.account_uuid", "user.email", "prompt", "body", "tool_input"]);
  return Object.fromEntries(Object.entries(attributes).filter(([k]) => !redacted.has(k)));
}

function makeSource(eventName: string): EyesEvent["source"] {
  return { kind: "claude_otel_log", surface: "claude", event: eventName };
}

/**
 * Normalize a parsed Claude Code OTel log record into an EyesEvent.
 * Expects pre-flattened attributes (resource + record merged).
 */
export function normalizeClaudeAttributes(
  attributes: Record<string, unknown>,
  timestamp: string,
  body: unknown,
): EyesEvent | null {
  const eventName = optionalString(attributes["event.name"]);
  const sid = sessionId(attributes);

  if (!eventName) {
    return {
      schema: "eyes4ai.event.v1",
      eventId: makeEventId(),
      timestamp,
      sessionId: sid,
      source: makeSource("unknown"),
      type: "raw",
      data: { attributes: sanitize(attributes), body },
    };
  }

  if (eventName === "claude_code.user_prompt") {
    const prompt = optionalString(attributes.prompt);
    return {
      schema: "eyes4ai.event.v1",
      eventId: makeEventId(),
      timestamp,
      sessionId: sid,
      source: makeSource(eventName),
      type: "ai.prompt",
      data: {
        model: optionalString(attributes.model),
        promptPreview: prompt ? prompt.trim().replace(/\s+/g, " ").slice(0, 160) : undefined,
        promptHash: prompt ? sha256(prompt) : undefined,
        rawPromptStored: false,
      },
    };
  }

  if (eventName === "claude_code.api_request") {
    const model = optionalString(attributes.model) ?? "unknown";
    const inputTokenCount = optionalNumber(attributes.input_tokens) ?? 0;
    const outputTokenCount = optionalNumber(attributes.output_tokens) ?? 0;
    const cachedTokenCount = optionalNumber(attributes.cache_read_tokens);

    // Claude provides cost_usd directly; also run our own estimate
    const directCost = optionalNumber(attributes.cost_usd);
    const estimated = estimateTokenCostUsd({
      model,
      inputTokenCount,
      outputTokenCount,
      ...(cachedTokenCount === undefined ? {} : { cachedTokenCount }),
    });

    return {
      schema: "eyes4ai.event.v1",
      eventId: makeEventId(),
      timestamp,
      sessionId: sid,
      source: makeSource(eventName),
      type: "ai.usage",
      data: {
        model,
        inputTokenCount,
        outputTokenCount,
        cachedTokenCount,
        estimatedCostUsd: directCost ?? estimated.estimatedCostUsd,
        costBasis: directCost !== undefined ? "token_estimate_only" : estimated.costBasis,
      },
    };
  }

  if (eventName === "claude_code.tool_result") {
    return {
      schema: "eyes4ai.event.v1",
      eventId: makeEventId(),
      timestamp,
      sessionId: sid,
      source: makeSource(eventName),
      type: "ai.tool_use.post",
      data: {
        toolName: optionalString(attributes.tool_name) ?? "unknown",
        durationMs: optionalNumber(attributes.duration_ms),
        success: optionalBoolean(attributes.success),
        mcpServer: optionalString(attributes.mcp_server_scope),
        observedViaOtel: true,
      },
    };
  }

  if (eventName === "claude_code.tool_decision") {
    return {
      schema: "eyes4ai.event.v1",
      eventId: makeEventId(),
      timestamp,
      sessionId: sid,
      source: makeSource(eventName),
      type: "ai.tool_decision",
      data: {
        toolName: optionalString(attributes.tool_name),
        decision: optionalString(attributes.decision),
        decisionSource: optionalString(attributes.source),
      },
    };
  }

  // Fallback: unknown Claude event
  return {
    schema: "eyes4ai.event.v1",
    eventId: makeEventId(),
    timestamp,
    sessionId: sid,
    source: makeSource(eventName),
    type: "raw",
    data: {
      attributes: sanitize(attributes),
      body,
    },
  };
}
