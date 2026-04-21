export interface PricingEntry {
  model: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  cachedInputPerMillionUsd?: number;
  source: string;
  toolFeesExcluded: boolean;
}

export interface AiUsageData {
  model: string;
  inputTokenCount: number;
  outputTokenCount: number;
  cachedTokenCount?: number;
  reasoningTokenCount?: number;
  toolTokenCount?: number;
  estimatedCostUsd?: number;
  costBasis?: "token_estimate_only" | "token_estimate_plus_modeled_tool_fees" | "unknown";
}

export interface PromptData {
  model?: string;
  promptPreview?: string;
  promptHash?: string;
  rawPromptStored: boolean;
}

export interface ToolUseData {
  toolName: string;
  toolUseId?: string;
  durationMs?: number;
  success?: boolean;
  mcpServer?: string;
  mcpServerOrigin?: string;
  observedViaOtel: boolean;
}

export interface GitCommitData {
  commit: string;
  branch: string;
  filesChanged: string[];
  relatedAiSessions: string[];
}

export type EyesEventData = PromptData | AiUsageData | ToolUseData | GitCommitData | Record<string, unknown>;

export interface EyesEvent {
  schema: "eyes-for-ai.event.v1";
  eventId: string;
  timestamp: string;
  sessionId: string;
  source: {
    kind: string;
    surface?: string;
    event: string;
  };
  type: "ai.prompt" | "ai.usage" | "ai.tool_use.post" | "git.commit" | "codex.raw";
  data: EyesEventData;
}

export interface OtlpAnyValue {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  boolValue?: boolean;
  kvlistValue?: {
    values?: Array<{ key: string; value?: OtlpAnyValue }>;
  };
  arrayValue?: {
    values?: OtlpAnyValue[];
  };
}

export interface OtlpKeyValue {
  key: string;
  value?: OtlpAnyValue;
}

export interface OtlpLogRecord {
  timeUnixNano?: string;
  observedTimeUnixNano?: string;
  body?: OtlpAnyValue;
  attributes?: OtlpKeyValue[];
}

export interface OtlpLogsRequest {
  resourceLogs?: Array<{
    resource?: {
      attributes?: OtlpKeyValue[];
    };
    scopeLogs?: Array<{
      logRecords?: OtlpLogRecord[];
    }>;
  }>;
}
