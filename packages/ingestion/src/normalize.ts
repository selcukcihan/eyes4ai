import { estimateTokenCostUsd } from "./pricing.js";
import { anyValueToPrimitive, attributesToRecord, coerceRecordPrimitives, logRecordTimestamp, makeEventId, sha256 } from "./otel.js";
import type { EyesEvent, OtlpLogRecord } from "../../schema/src/index.js";

function normalizeSessionId(attributes: Record<string, unknown>): string {
  const raw = attributes["conversation.id"];
  return typeof raw === "string" && raw.length > 0 ? raw : "unknown-session";
}

function normalizeModel(attributes: Record<string, unknown>): string | undefined {
  const model = attributes.model;
  return typeof model === "string" && model.length > 0 ? model : undefined;
}

function promptPreview(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  return trimmed.slice(0, 160);
}

function sanitizeRawAttributes(attributes: Record<string, unknown>): Record<string, unknown> {
  const redacted = new Set([
    "user.account_id",
    "user.email",
    "prompt",
    "arguments",
    "output"
  ]);

  return Object.fromEntries(
    Object.entries(attributes).flatMap(([key, value]) => {
      if (redacted.has(key)) {
        return [];
      }
      return [[key, value]];
    })
  );
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeFromParts(
  attributes: Record<string, unknown>,
  timestamp: string,
  body: unknown
): EyesEvent | null {
  const eventName = typeof attributes["event.name"] === "string" ? attributes["event.name"] : undefined;
  const sessionId = normalizeSessionId(attributes);
  const model = normalizeModel(attributes);

  if (!eventName) {
    return {
      schema: "eyes-for-ai.event.v1",
      eventId: makeEventId(),
      timestamp,
      sessionId,
      source: {
        kind: "codex_otel_log",
        surface: "codex",
        event: "unknown"
      },
      type: "codex.raw",
      data: {
        model,
        attributes: sanitizeRawAttributes(attributes),
        body
      }
    };
  }

  if (eventName === "codex.user_prompt") {
    const prompt = typeof attributes.prompt === "string" ? attributes.prompt : "";
    return {
      schema: "eyes-for-ai.event.v1",
      eventId: makeEventId(),
      timestamp,
      sessionId,
      source: {
        kind: "codex_otel_log",
        surface: "codex",
        event: eventName
      },
      type: "ai.prompt",
      data: {
        model,
        promptPreview: prompt ? promptPreview(prompt) : undefined,
        promptHash: prompt ? sha256(prompt) : undefined,
        rawPromptStored: false
      }
    };
  }

  if (eventName === "codex.tool_result") {
    return {
      schema: "eyes-for-ai.event.v1",
      eventId: makeEventId(),
      timestamp,
      sessionId,
      source: {
        kind: "codex_otel_log",
        surface: "codex",
        event: eventName
      },
      type: "ai.tool_use.post",
      data: {
        toolName: typeof attributes.tool_name === "string" ? attributes.tool_name : "unknown",
        toolUseId: optionalString(attributes.call_id),
        durationMs: optionalNumber(attributes.duration_ms),
        success: optionalBoolean(attributes.success),
        mcpServer: optionalString(attributes.mcp_server),
        mcpServerOrigin: optionalString(attributes.mcp_server_origin),
        observedViaOtel: true
      }
    };
  }

  if (eventName === "codex.tool_decision") {
    return {
      schema: "eyes-for-ai.event.v1",
      eventId: makeEventId(),
      timestamp,
      sessionId,
      source: {
        kind: "codex_otel_log",
        surface: "codex",
        event: eventName
      },
      type: "ai.tool_decision",
      data: {
        toolName: optionalString(attributes.tool_name),
        toolUseId: optionalString(attributes.call_id),
        decision: optionalString(attributes.decision),
        decisionSource: optionalString(attributes.source)
      }
    };
  }

  if (eventName === "codex.conversation_starts") {
    const mcpServers = optionalString(attributes.mcp_servers)
      ?.split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return {
      schema: "eyes-for-ai.event.v1",
      eventId: makeEventId(),
      timestamp,
      sessionId,
      source: {
        kind: "codex_otel_log",
        surface: "codex",
        event: eventName
      },
      type: "ai.session.start",
      data: {
        model,
        providerName: optionalString(attributes.provider_name),
        reasoningEffort: optionalString(attributes.reasoning_effort),
        reasoningSummary: optionalString(attributes.reasoning_summary),
        approvalPolicy: optionalString(attributes.approval_policy),
        sandboxPolicy: optionalString(attributes.sandbox_policy),
        mcpServers
      }
    };
  }

  if (eventName === "codex.websocket_connect" || eventName === "codex.websocket_request" || eventName === "codex.websocket_event") {
    const category =
      eventName === "codex.websocket_connect"
        ? "websocket_connect"
        : eventName === "codex.websocket_request"
          ? "websocket_request"
          : "websocket_event";

    return {
      schema: "eyes-for-ai.event.v1",
      eventId: makeEventId(),
      timestamp,
      sessionId,
      source: {
        kind: "codex_otel_log",
        surface: "codex",
        event: eventName
      },
      type: "ai.transport",
      data: {
        category,
        eventKind: optionalString(attributes["event.kind"]),
        durationMs: optionalNumber(attributes.duration_ms),
        success: optionalBoolean(attributes.success),
        connectionReused: optionalBoolean(attributes["auth.connection_reused"]),
        endpoint: optionalString(attributes.endpoint)
      }
    };
  }

  if (eventName === "codex.sse_event" && attributes["event.kind"] === "response.completed") {
    const inputTokenCount = optionalNumber(attributes.input_token_count) ?? 0;
    const outputTokenCount = optionalNumber(attributes.output_token_count) ?? 0;
    const cachedTokenCount = optionalNumber(attributes.cached_token_count);
    const reasoningTokenCount = optionalNumber(attributes.reasoning_token_count);
    const toolTokenCount = optionalNumber(attributes.tool_token_count);
    const estimated = model
      ? estimateTokenCostUsd({
          model,
          inputTokenCount,
          outputTokenCount,
          ...(cachedTokenCount === undefined ? {} : { cachedTokenCount })
        })
      : { costBasis: "unknown" as const };

    return {
      schema: "eyes-for-ai.event.v1",
      eventId: makeEventId(),
      timestamp,
      sessionId,
      source: {
        kind: "codex_otel_log",
        surface: "codex",
        event: eventName
      },
      type: "ai.usage",
      data: {
        model: model ?? "unknown",
        inputTokenCount,
        outputTokenCount,
        cachedTokenCount,
        reasoningTokenCount,
        toolTokenCount,
        estimatedCostUsd: estimated.estimatedCostUsd,
        estimatedCreditCost: estimated.estimatedCreditCost,
        costBasis: estimated.costBasis
      }
    };
  }

  return {
    schema: "eyes-for-ai.event.v1",
    eventId: makeEventId(),
    timestamp,
    sessionId,
    source: {
      kind: "codex_otel_log",
      surface: "codex",
      event: eventName ?? "unknown"
    },
    type: "codex.raw",
    data: {
      model,
      attributes: sanitizeRawAttributes(attributes),
      body
    }
  };
}

export function normalizeCodexLogRecord(record: OtlpLogRecord, resourceAttributes: Record<string, unknown>): EyesEvent | null {
  const attributes = coerceRecordPrimitives({
    ...resourceAttributes,
    ...attributesToRecord(record.attributes)
  });
  const timestamp = logRecordTimestamp(record);
  const body = anyValueToPrimitive(record.body);
  return normalizeFromParts(attributes, timestamp, body);
}

export function upgradeNormalizedEvent(event: EyesEvent): EyesEvent {
  if (event.type === "ai.usage") {
    const data = event.data as Record<string, unknown>;
    const model = optionalString(data.model);
    const inputTokenCount = optionalNumber(data.inputTokenCount) ?? 0;
    const outputTokenCount = optionalNumber(data.outputTokenCount) ?? 0;
    const cachedTokenCount = optionalNumber(data.cachedTokenCount);
    const estimated = model
      ? estimateTokenCostUsd({
          model,
          inputTokenCount,
          outputTokenCount,
          ...(cachedTokenCount === undefined ? {} : { cachedTokenCount })
        })
      : { costBasis: "unknown" as const };

    return {
      ...event,
      data: {
        ...data,
        ...(estimated.estimatedCostUsd === undefined ? {} : { estimatedCostUsd: estimated.estimatedCostUsd }),
        ...(estimated.estimatedCreditCost === undefined ? {} : { estimatedCreditCost: estimated.estimatedCreditCost }),
        costBasis: estimated.costBasis
      }
    };
  }

  if (event.type !== "codex.raw") {
    return event;
  }

  const attributes = (event.data as Record<string, unknown>).attributes;
  const body = (event.data as Record<string, unknown>).body;
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    return event;
  }

  const maybeTimestamp = (attributes as Record<string, unknown>)["event.timestamp"];
  const timestamp = typeof maybeTimestamp === "string" ? maybeTimestamp : event.timestamp;
  return normalizeFromParts(coerceRecordPrimitives(attributes as Record<string, unknown>), timestamp, body) ?? event;
}
