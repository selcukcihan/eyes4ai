import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { EyesEvent, GitCommitData, AiUsageData } from "../../schema/src/index.js";

// ── Data loading ──────────────────────────────────────────────────────

export async function loadEventsForRepo(repoPath: string): Promise<EyesEvent[]> {
  const eventsDir = path.join(repoPath, ".eyes4ai", "private", "events");
  let files: string[];
  try {
    files = (await readdir(eventsDir)).filter((name) => name.endsWith(".jsonl")).sort();
  } catch {
    return [];
  }
  const events: EyesEvent[] = [];

  for (const file of files) {
    const content = await readFile(path.join(eventsDir, file), "utf8");
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      try {
        events.push(JSON.parse(line) as EyesEvent);
      } catch {
        // skip malformed lines
      }
    }
  }

  return events;
}

function filterByPeriod(events: EyesEvent[], startDate: Date, endDate: Date): EyesEvent[] {
  const start = startDate.getTime();
  const end = endDate.getTime();
  return events.filter((e) => {
    if (e.timestamp.startsWith("1970")) return false;
    const ts = Date.parse(e.timestamp);
    return !Number.isNaN(ts) && ts >= start && ts <= end;
  });
}

// ── Report data structures ────────────────────────────────────────────

export interface PeriodReport {
  periodLabel: string;
  startDate: string;
  endDate: string;
  days: number;

  // AI activity
  sessions: number;
  turns: number;
  activeDays: number;
  estimatedCost: number;

  // Committed output
  aiLinkedCommits: number;
  totalCommits: number;
  filesCommitted: number;
  linesAdded: number;
  linesDeleted: number;

  // Yield
  sessionToCommitRate: number | null;
  avgTurnsPerCommit: number | null;
  avgCostPerCommit: number | null;
  abandonedSessions: number;
}

export interface MvpReport {
  current: PeriodReport;
  previous: PeriodReport | null;
}

// ── Aggregation ───────────────────────────────────────────────────────

function computePeriodReport(
  events: EyesEvent[],
  periodLabel: string,
  startDate: Date,
  endDate: Date,
  days: number,
): PeriodReport {
  const periodEvents = filterByPeriod(events, startDate, endDate);

  // Sessions: unique sessionIds from non-noise events
  const significantTypes = new Set(["ai.prompt", "ai.usage", "ai.tool_use.post", "ai.session.start", "ai.tool_decision"]);
  const sessionIds = new Set<string>();
  for (const e of periodEvents) {
    if (significantTypes.has(e.type)) {
      sessionIds.add(e.sessionId);
    }
  }
  const sessions = sessionIds.size;

  // Turns: count of ai.prompt events
  const turns = periodEvents.filter((e) => e.type === "ai.prompt").length;

  // Active days: unique days with significant activity
  const activeDaySet = new Set<string>();
  for (const e of periodEvents) {
    if (!significantTypes.has(e.type)) continue;
    const day = e.timestamp.slice(0, 10);
    if (day !== "1970-01-01") activeDaySet.add(day);
  }
  const activeDays = activeDaySet.size;

  // Cost
  let estimatedCost = 0;
  for (const e of periodEvents) {
    if (e.type !== "ai.usage") continue;
    const data = e.data as AiUsageData;
    if (typeof data.estimatedCostUsd === "number") {
      estimatedCost += data.estimatedCostUsd;
    }
  }

  // Git commits
  const commitEvents = periodEvents.filter((e) => e.type === "git.commit");
  const totalCommits = commitEvents.length;
  let aiLinkedCommits = 0;
  let filesCommitted = 0;
  let linesAdded = 0;
  let linesDeleted = 0;
  const sessionsWithCommits = new Set<string>();

  for (const e of commitEvents) {
    const data = e.data as GitCommitData;
    filesCommitted += data.filesChanged.length;
    linesAdded += data.linesAdded ?? 0;
    linesDeleted += data.linesDeleted ?? 0;
    if (data.relatedAiSessions.length > 0) {
      aiLinkedCommits++;
      for (const sid of data.relatedAiSessions) {
        sessionsWithCommits.add(sid);
      }
    }
  }

  // Yield metrics
  const sessionToCommitRate = sessions > 0 ? aiLinkedCommits / sessions : null;
  const avgTurnsPerCommit = aiLinkedCommits > 0 ? turns / aiLinkedCommits : null;
  const avgCostPerCommit = aiLinkedCommits > 0 ? estimatedCost / aiLinkedCommits : null;
  const abandonedSessions = sessions > 0 ? sessions - sessionsWithCommits.size : 0;

  return {
    periodLabel,
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    days,
    sessions,
    turns,
    activeDays,
    estimatedCost: Number(estimatedCost.toFixed(2)),
    aiLinkedCommits,
    totalCommits,
    filesCommitted,
    linesAdded,
    linesDeleted,
    sessionToCommitRate,
    avgTurnsPerCommit,
    avgCostPerCommit,
    abandonedSessions,
  };
}

export async function generateMvpReport(repoPath: string, days: number = 7): Promise<MvpReport> {
  const events = await loadEventsForRepo(repoPath);

  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startDate = new Date(endDate.getTime() - days * 86_400_000 + 1);

  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - days * 86_400_000 + 1);

  const current = computePeriodReport(events, `last ${days} days`, startDate, endDate, days);

  // Only include previous period if there's any data in it
  const prevEvents = filterByPeriod(events, prevStartDate, prevEndDate);
  const previous = prevEvents.length > 0
    ? computePeriodReport(events, `previous ${days} days`, prevStartDate, prevEndDate, days)
    : null;

  return { current, previous };
}

// ── Rendering ─────────────────────────────────────────────────────────

function pct(n: number | null): string {
  if (n === null) return "—";
  return `${Math.round(n * 100)}%`;
}

function money(n: number | null): string {
  if (n === null) return "—";
  return `$${n.toFixed(2)}`;
}

function num(n: number | null, decimals: number = 1): string {
  if (n === null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(decimals);
}

function pad(label: string, value: string, width: number = 28): string {
  return `  ${label.padEnd(width)}${value}`;
}

export function renderMvpReport(report: MvpReport): string {
  const { current: c, previous: p } = report;
  const lines: string[] = [];

  lines.push(`Period: ${c.periodLabel}`);
  lines.push("");

  lines.push("AI activity");
  lines.push(pad("Sessions:", String(c.sessions)));
  lines.push(pad("Turns:", String(c.turns)));
  lines.push(pad("AI-active days:", `${c.activeDays} / ${c.days}`));
  lines.push(pad("Estimated cost:", money(c.estimatedCost)));
  lines.push("");

  lines.push("Committed output");
  lines.push(pad("AI-linked commits:", String(c.aiLinkedCommits)));
  lines.push(pad("Files committed:", String(c.filesCommitted)));
  lines.push(pad("Lines changed:", `+${c.linesAdded.toLocaleString()} / -${c.linesDeleted.toLocaleString()}`));
  lines.push("");

  lines.push("Yield");
  lines.push(pad("Session-to-commit rate:", pct(c.sessionToCommitRate)));
  lines.push(pad("Avg turns per commit:", num(c.avgTurnsPerCommit)));
  lines.push(pad("Avg cost per commit:", money(c.avgCostPerCommit)));
  lines.push(pad("Abandoned sessions:", String(c.abandonedSessions)));

  if (p) {
    lines.push("");
    lines.push("Trend");
    lines.push(pad("Previous period:", `${pct(p.sessionToCommitRate)} yield, ${money(p.avgCostPerCommit)} / commit`));
    lines.push(pad("This period:", `${pct(c.sessionToCommitRate)} yield, ${money(c.avgCostPerCommit)} / commit`));
  }

  return lines.join("\n");
}

// ── Legacy API (kept for --json backward compat) ──────────────────────

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

export interface HistogramPoint {
  day: string;
  count: number;
}

export interface ToolInvocationSummary {
  toolName: string;
  count: number;
}

export async function generateRepoReport(repoPath: string): Promise<RepoReport> {
  const events = await loadEventsForRepo(repoPath);
  const sessionCounts = new Map<string, number>();
  for (const event of events) {
    sessionCounts.set(event.sessionId, (sessionCounts.get(event.sessionId) ?? 0) + 1);
  }

  const reportableEvents = events.filter((event) => (sessionCounts.get(event.sessionId) ?? 0) >= 3);

  let totalTokensConsumed = 0;
  let totalEstimatedCostUsd = 0;
  let totalCredits = 0;
  let hasCreditData = false;

  for (const event of reportableEvents) {
    if (event.type !== "ai.usage") continue;
    const data = event.data as AiUsageData;
    const keys = ["inputTokenCount", "outputTokenCount", "cachedTokenCount", "reasoningTokenCount", "toolTokenCount"] as const;
    for (const key of keys) {
      const v = data[key as keyof AiUsageData];
      if (typeof v === "number") totalTokensConsumed += v;
    }
    if (typeof data.estimatedCostUsd === "number") totalEstimatedCostUsd += data.estimatedCostUsd;
    if (typeof data.estimatedCreditCost === "number") {
      totalCredits += data.estimatedCreditCost;
      hasCreditData = true;
    }
  }

  const codeChangingTools = new Set(["apply_patch", "write_file", "edit_file", "replace_in_file"]);
  const codeChangingInvocations = reportableEvents.filter(
    (e) => e.type === "ai.tool_use.post" && codeChangingTools.has((e.data as Record<string, unknown>).toolName as string),
  ).length;

  // Tool invocation summary
  const toolCounts = new Map<string, number>();
  for (const e of reportableEvents) {
    if (e.type !== "ai.tool_use.post") continue;
    const name = (e.data as Record<string, unknown>).toolName as string;
    if (name) toolCounts.set(name, (toolCounts.get(name) ?? 0) + 1);
  }

  // Activity histogram
  const dayCounts = new Map<string, number>();
  const sigTypes = new Set(["ai.prompt", "ai.usage", "ai.tool_use.post", "ai.session.start", "ai.tool_decision"]);
  for (const e of reportableEvents) {
    if (!sigTypes.has(e.type) || e.timestamp.startsWith("1970")) continue;
    const day = e.timestamp.slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  // AI time
  const perSession = new Map<string, { min: number; max: number }>();
  for (const e of reportableEvents) {
    if (e.timestamp.startsWith("1970")) continue;
    const ts = Date.parse(e.timestamp);
    if (Number.isNaN(ts)) continue;
    const cur = perSession.get(e.sessionId);
    if (!cur) {
      perSession.set(e.sessionId, { min: ts, max: ts });
    } else {
      cur.min = Math.min(cur.min, ts);
      cur.max = Math.max(cur.max, ts);
    }
  }
  let totalAiTimeMs = 0;
  for (const s of perSession.values()) totalAiTimeMs += Math.max(0, s.max - s.min);

  return {
    repoPath,
    aiGeneratedCodePct: null,
    aiGeneratedCodeStatus: "insufficient_signals",
    aiGeneratedCodeExplanation: "Current telemetry does not provide user line-level edit attribution.",
    codeChangingAiToolInvocations: codeChangingInvocations,
    totalTokensConsumed,
    totalEstimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(6)),
    totalEstimatedCreditCost: hasCreditData ? Number(totalCredits.toFixed(6)) : null,
    totalAiTimeMs,
    toolInvocations: [...toolCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([toolName, count]) => ({ toolName, count })),
    activityHistogram: [...dayCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({ day, count })),
  };
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
  const max = Math.max(...report.activityHistogram.map((p) => p.count), 1);
  for (const p of report.activityHistogram) {
    const w = Math.max(1, Math.round((p.count / max) * 24));
    lines.push(`   ${p.day} ${"█".repeat(w)} ${p.count}`);
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
  const secs = Math.floor(report.totalAiTimeMs / 1000);
  const mins = Math.floor(secs / 60);
  const hrs = Math.floor(mins / 60);
  const timeStr = hrs > 0 ? `${hrs}h ${mins % 60}m ${secs % 60}s` : mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`;
  lines.push(`   ${timeStr}`);
  lines.push("6. Tool invocations");
  for (const t of report.toolInvocations) lines.push(`   ${t.toolName}: ${t.count}`);
  if (report.toolInvocations.length === 0) lines.push("   No tool invocations recorded.");
  return lines.join("\n");
}
