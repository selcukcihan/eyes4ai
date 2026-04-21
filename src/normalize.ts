import { estimateTokenCostUsd } from "./pricing.js";
import { anyValueToPrimitive, attributesToRecord, logRecordTimestamp, makeEventId, sha256 } from "./otel.js";
import type { EyesEvent, OtlpLogRecord } from "./types.js";

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

export function normalizeCodexLogRecord(record: OtlpLogRecord, resourceAttributes: Record<string, unknown>): EyesEvent | null {
  const attributes = {
    ...resourceAttributes,
    ...attributesToRecord(record.attributes)
  };
  const eventName = typeof attributes["event.name"] === "string" ? attributes["event.name"] : undefined;
  const sessionId = normalizeSessionId(attributes);
  const timestamp = logRecordTimestamp(record);
  const model = normalizeModel(attributes);

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
        toolUseId: typeof attributes.call_id === "string" ? attributes.call_id : undefined,
        durationMs: typeof attributes.duration_ms === "number" ? attributes.duration_ms : undefined,
        success: attributes.success === "true" || attributes.success === true,
        mcpServer: typeof attributes.mcp_server === "string" && attributes.mcp_server !== "" ? attributes.mcp_server : undefined,
        mcpServerOrigin: typeof attributes.mcp_server_origin === "string" && attributes.mcp_server_origin !== "" ? attributes.mcp_server_origin : undefined,
        observedViaOtel: true
      }
    };
  }

  if (eventName === "codex.sse_event" && attributes["event.kind"] === "response.completed") {
    const inputTokenCount = typeof attributes.input_token_count === "number" ? attributes.input_token_count : 0;
    const outputTokenCount = typeof attributes.output_token_count === "number" ? attributes.output_token_count : 0;
    const cachedTokenCount = typeof attributes.cached_token_count === "number" ? attributes.cached_token_count : undefined;
    const reasoningTokenCount = typeof attributes.reasoning_token_count === "number" ? attributes.reasoning_token_count : undefined;
    const toolTokenCount = typeof attributes.tool_token_count === "number" ? attributes.tool_token_count : undefined;
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
        costBasis: estimated.costBasis
      }
    };
  }

  const body = anyValueToPrimitive(record.body);
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
      attributes,
      body
    }
  };
}
