import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { EyesEvent } from "../../schema/src/index.js";

export interface HistogramPoint {
  day: string;
  count: number;
}

export interface ToolInvocationSummary {
  toolName: string;
  count: number;
}

export interface RepoReport {
  repoPath: string;
  aiGeneratedCodePct: number | null;
  aiGeneratedCodeStatus: "estimated" | "insufficient_signals";
  aiGeneratedCodeExplanation: string;
  codeChangingAiToolInvocations: number;
  totalTokensConsumed: number;
  totalEstimatedCostUsd: number;
  totalEstimatedCreditCost: number | null;
  totalAiTimeMs: number;
  toolInvocations: ToolInvocationSummary[];
  activityHistogram: HistogramPoint[];
}

function isMeaningfulTimestamp(timestamp: string): boolean {
  return !timestamp.startsWith("1970-01-01");
}

function dayFromTimestamp(timestamp: string): string | null {
  if (!isMeaningfulTimestamp(timestamp)) {
    return null;
  }
  return timestamp.slice(0, 10);
}

function sumUsageTokens(event: EyesEvent): number {
  if (event.type !== "ai.usage") {
    return 0;
  }
  const data = event.data as Record<string, unknown>;
  const keys = [
    "inputTokenCount",
    "outputTokenCount",
    "cachedTokenCount",
    "reasoningTokenCount",
    "toolTokenCount"
  ];
  return keys.reduce((total, key) => {
    const value = data[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function sumUsageCost(event: EyesEvent): number {
  if (event.type !== "ai.usage") {
    return 0;
  }
  const cost = (event.data as Record<string, unknown>).estimatedCostUsd;
  return typeof cost === "number" ? cost : 0;
}

function sumUsageCredits(event: EyesEvent): number {
  if (event.type !== "ai.usage") {
    return 0;
  }
  const credits = (event.data as Record<string, unknown>).estimatedCreditCost;
  return typeof credits === "number" ? credits : 0;
}

function extractToolName(event: EyesEvent): string | null {
  if (event.type !== "ai.tool_use.post") {
    return null;
  }
  const toolName = (event.data as Record<string, unknown>).toolName;
  return typeof toolName === "string" ? toolName : null;
}

function codeChangingAiToolInvocations(events: EyesEvent[]): number {
  const codeChangingTools = new Set([
    "apply_patch",
    "write_file",
    "edit_file",
    "replace_in_file"
  ]);

  return events.filter((event) => {
    if (event.type !== "ai.tool_use.post") {
      return false;
    }
    const toolName = extractToolName(event);
    return toolName !== null && codeChangingTools.has(toolName);
  }).length;
}

function totalAiTimeMs(events: EyesEvent[]): number {
  const perSession = new Map<string, { min: number; max: number }>();

  for (const event of events) {
    if (!isMeaningfulTimestamp(event.timestamp)) {
      continue;
    }
    const time = Date.parse(event.timestamp);
    if (Number.isNaN(time)) {
      continue;
    }
    const current = perSession.get(event.sessionId);
    if (!current) {
      perSession.set(event.sessionId, { min: time, max: time });
      continue;
    }
    current.min = Math.min(current.min, time);
    current.max = Math.max(current.max, time);
  }

  let total = 0;
  for (const session of perSession.values()) {
    total += Math.max(0, session.max - session.min);
  }
  return total;
}

function activityHistogram(events: EyesEvent[]): HistogramPoint[] {
  const significantTypes = new Set([
    "ai.prompt",
    "ai.usage",
    "ai.tool_use.post",
    "ai.session.start",
    "ai.tool_decision"
  ]);

  const counts = new Map<string, number>();
  for (const event of events) {
    if (!significantTypes.has(event.type)) {
      continue;
    }
    const day = dayFromTimestamp(event.timestamp);
    if (!day) {
      continue;
    }
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }));
}

function toolInvocationSummary(events: EyesEvent[]): ToolInvocationSummary[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const toolName = extractToolName(event);
    if (!toolName) {
      continue;
    }
    counts.set(toolName, (counts.get(toolName) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([toolName, count]) => ({ toolName, count }));
}

export async function loadEventsForRepo(repoPath: string): Promise<EyesEvent[]> {
  const eventsDir = path.join(repoPath, ".ai", "private", "events");
  const files = (await readdir(eventsDir)).filter((name) => name.endsWith(".jsonl")).sort();
  const events: EyesEvent[] = [];

  for (const file of files) {
    const content = await readFile(path.join(eventsDir, file), "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) {
        continue;
      }
      events.push(JSON.parse(line) as EyesEvent);
    }
  }

  return events;
}

export async function generateRepoReport(repoPath: string): Promise<RepoReport> {
  const events = await loadEventsForRepo(repoPath);
  const sessionCounts = new Map<string, number>();
  for (const event of events) {
    sessionCounts.set(event.sessionId, (sessionCounts.get(event.sessionId) ?? 0) + 1);
  }

  const reportableEvents = events.filter((event) => (sessionCounts.get(event.sessionId) ?? 0) >= 3);
  const totalTokensConsumed = reportableEvents.reduce((total, event) => total + sumUsageTokens(event), 0);
  const totalEstimatedCostUsd = Number(reportableEvents.reduce((total, event) => total + sumUsageCost(event), 0).toFixed(6));
  const creditBearingUsageEvents = reportableEvents.filter((event) => {
    if (event.type !== "ai.usage") {
      return false;
    }
    return typeof (event.data as Record<string, unknown>).estimatedCreditCost === "number";
  });
  const totalEstimatedCreditCost = creditBearingUsageEvents.length === 0
    ? null
    : Number(creditBearingUsageEvents.reduce((total, event) => total + sumUsageCredits(event), 0).toFixed(6));
  const codeChangingInvocations = codeChangingAiToolInvocations(reportableEvents);

  return {
    repoPath,
    aiGeneratedCodePct: null,
    aiGeneratedCodeStatus: "insufficient_signals",
    aiGeneratedCodeExplanation: "Current telemetry does not provide user line-level edit attribution, so AI-vs-user code share cannot be measured accurately yet.",
    codeChangingAiToolInvocations: codeChangingInvocations,
    totalTokensConsumed,
    totalEstimatedCostUsd,
    totalEstimatedCreditCost,
    totalAiTimeMs: totalAiTimeMs(reportableEvents),
    toolInvocations: toolInvocationSummary(reportableEvents),
    activityHistogram: activityHistogram(reportableEvents)
  };
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

function renderHistogram(points: HistogramPoint[]): string[] {
  const max = Math.max(...points.map((point) => point.count), 1);
  return points.map((point) => {
    const width = Math.max(1, Math.round((point.count / max) * 24));
    return `${point.day} ${"█".repeat(width)} ${point.count}`;
  });
}

export function renderRepoReport(report: RepoReport): string {
  const lines: string[] = [];
  lines.push(`Repo: ${report.repoPath}`);
  lines.push("");
  lines.push("1. AI generated code vs user code");
  if (report.aiGeneratedCodePct === null) {
    lines.push(`   Unavailable: ${report.aiGeneratedCodeExplanation}`);
    lines.push(`   AI code-changing tool invocations observed: ${report.codeChangingAiToolInvocations}`);
  } else {
    lines.push(`   ${report.aiGeneratedCodePct.toFixed(1)}%`);
  }
  lines.push("2. Total tokens consumed");
  lines.push(`   ${report.totalTokensConsumed.toLocaleString()}`);
  lines.push("3. AI activity histogram per day");
  for (const line of renderHistogram(report.activityHistogram)) {
    lines.push(`   ${line}`);
  }
  if (report.activityHistogram.length === 0) {
    lines.push("   No activity with reliable timestamps yet.");
  }
  lines.push("4. Costs");
  if (report.totalEstimatedCreditCost !== null) {
    lines.push(`   Codex credits: ${report.totalEstimatedCreditCost.toFixed(6)}`);
  } else {
    lines.push("   Codex credits: unavailable for the observed model mix.");
  }
  lines.push(`   API-equivalent USD: $${report.totalEstimatedCostUsd.toFixed(6)}`);
  lines.push("5. Total time spent by AI");
  lines.push(`   ${formatDuration(report.totalAiTimeMs)}`);
  lines.push("6. Tool invocations");
  for (const tool of report.toolInvocations) {
    lines.push(`   ${tool.toolName}: ${tool.count}`);
  }
  if (report.toolInvocations.length === 0) {
    lines.push("   No tool invocations recorded.");
  }
  return lines.join("\n");
}
