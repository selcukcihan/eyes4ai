import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { loadEventsForRepo, generateMvpReport, renderMvpReport } from "../src/index.js";
import type { EyesEvent } from "../../schema/src/index.js";

const tmpRoot = path.join("/tmp", `.eyes4ai-report-${process.pid}`);
const eventsDir = path.join(tmpRoot, ".eyes4ai", "private", "events");

function makeEvent(overrides: Partial<EyesEvent> & { type: EyesEvent["type"] }): EyesEvent {
  return {
    schema: "eyes4ai.event.v1",
    eventId: `evt-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    sessionId: "sess-1",
    source: { kind: "codex_otel_log", surface: "codex", event: "test" },
    data: {},
    ...overrides,
  };
}

async function writeEvents(filename: string, events: EyesEvent[]): Promise<void> {
  await mkdir(eventsDir, { recursive: true });
  const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  await writeFile(path.join(eventsDir, filename), lines, "utf8");
}

describe("loadEventsForRepo", () => {
  beforeEach(async () => {
    await mkdir(eventsDir, { recursive: true });
  });
  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("returns empty array when no events dir exists", async () => {
    await rm(tmpRoot, { recursive: true, force: true });
    const events = await loadEventsForRepo(tmpRoot);
    assert.deepEqual(events, []);
  });

  it("loads events from JSONL files", async () => {
    const evt = makeEvent({ type: "ai.prompt" });
    await writeEvents("2025-04-20.jsonl", [evt]);
    const events = await loadEventsForRepo(tmpRoot);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.type, "ai.prompt");
  });

  it("skips malformed lines", async () => {
    const content = '{"bad json\n' + JSON.stringify(makeEvent({ type: "ai.prompt" })) + "\n";
    await writeFile(path.join(eventsDir, "2025-04-20.jsonl"), content, "utf8");
    const events = await loadEventsForRepo(tmpRoot);
    assert.equal(events.length, 1);
  });
});

describe("computePeriodReport (via generateMvpReport)", () => {
  beforeEach(async () => {
    await mkdir(eventsDir, { recursive: true });
  });
  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("computes sessions from unique sessionIds", async () => {
    const now = new Date();
    const ts = now.toISOString();
    await writeEvents("today.jsonl", [
      makeEvent({ type: "ai.prompt", timestamp: ts, sessionId: "s1" }),
      makeEvent({ type: "ai.prompt", timestamp: ts, sessionId: "s1" }),
      makeEvent({ type: "ai.prompt", timestamp: ts, sessionId: "s2" }),
    ]);
    const report = await generateMvpReport(tmpRoot, 7);
    assert.equal(report.current.sessions, 2);
    assert.equal(report.current.turns, 3);
  });

  it("computes estimated cost from ai.usage events", async () => {
    const ts = new Date().toISOString();
    await writeEvents("today.jsonl", [
      makeEvent({
        type: "ai.usage",
        timestamp: ts,
        sessionId: "s1",
        data: {
          model: "gpt-5.4",
          inputTokenCount: 1000,
          outputTokenCount: 500,
          estimatedCostUsd: 1.5,
          costBasis: "token_and_credit_estimate" as const,
        },
      }),
      makeEvent({
        type: "ai.usage",
        timestamp: ts,
        sessionId: "s1",
        data: {
          model: "gpt-5.4",
          inputTokenCount: 2000,
          outputTokenCount: 1000,
          estimatedCostUsd: 2.5,
          costBasis: "token_and_credit_estimate" as const,
        },
      }),
    ]);
    const report = await generateMvpReport(tmpRoot, 7);
    assert.equal(report.current.estimatedCost, 4);
  });

  it("tracks per-tool breakdown", async () => {
    const ts = new Date().toISOString();
    await writeEvents("today.jsonl", [
      makeEvent({
        type: "ai.prompt",
        timestamp: ts,
        sessionId: "s1",
        source: { kind: "codex_otel_log", surface: "codex", event: "codex.user_prompt" },
      }),
      makeEvent({
        type: "ai.prompt",
        timestamp: ts,
        sessionId: "s2",
        source: { kind: "claude_otel_log", surface: "claude", event: "claude_code.user_prompt" },
      }),
      makeEvent({
        type: "ai.prompt",
        timestamp: ts,
        sessionId: "s2",
        source: { kind: "claude_otel_log", surface: "claude", event: "claude_code.user_prompt" },
      }),
    ]);
    const report = await generateMvpReport(tmpRoot, 7);
    assert.equal(report.current.byTool.codex?.sessions, 1);
    assert.equal(report.current.byTool.codex?.turns, 1);
    assert.equal(report.current.byTool.claude?.sessions, 1);
    assert.equal(report.current.byTool.claude?.turns, 2);
  });

  it("computes git commit yield metrics", async () => {
    const ts = new Date().toISOString();
    await writeEvents("today.jsonl", [
      makeEvent({ type: "ai.prompt", timestamp: ts, sessionId: "s1" }),
      makeEvent({ type: "ai.prompt", timestamp: ts, sessionId: "s2" }),
      makeEvent({
        type: "git.commit",
        timestamp: ts,
        sessionId: "commit-1",
        data: {
          commit: "abc123",
          branch: "main",
          filesChanged: ["file.ts"],
          linesAdded: 50,
          linesDeleted: 10,
          relatedAiSessions: ["s1"],
        },
      }),
    ]);
    const report = await generateMvpReport(tmpRoot, 7);
    assert.equal(report.current.aiLinkedCommits, 1);
    assert.equal(report.current.totalCommits, 1);
    assert.equal(report.current.aiCommitPct, 1); // 1/1 = 100%
    assert.ok(report.current.avgCostPerCommit === null || typeof report.current.avgCostPerCommit === "number");
  });

  it("returns null previous period when no older data", async () => {
    const ts = new Date().toISOString();
    await writeEvents("today.jsonl", [
      makeEvent({ type: "ai.prompt", timestamp: ts, sessionId: "s1" }),
    ]);
    const report = await generateMvpReport(tmpRoot, 7);
    assert.equal(report.previous, null);
  });
});

describe("renderMvpReport", () => {
  it("renders without crashing for minimal report", () => {
    const output = renderMvpReport({
      current: {
        periodLabel: "last 7 days",
        startDate: "2025-04-13",
        endDate: "2025-04-20",
        days: 7,
        sessions: 0,
        turns: 0,
        activeDays: 0,
        estimatedCost: 0,
        byTool: {},
        aiLinkedCommits: 0,
        totalCommits: 0,
        aiCommitPct: null,
        aiLinesChanged: 0,
        totalLinesChanged: 0,
        aiLinesPct: null,
        avgCostPerCommit: null,
      },
      previous: null,
      dailyActivity: [],
    });
    assert.ok(output.includes("Sessions:"));
    assert.ok(output.includes("AI-linked commits:"));
    assert.ok(!output.includes("Previous")); // no previous period
  });

  it("includes previous period when it exists", () => {
    const period = {
      periodLabel: "test",
      startDate: "2025-04-01",
      endDate: "2025-04-07",
      days: 7,
      sessions: 5,
      turns: 20,
      activeDays: 4,
      estimatedCost: 10,
      byTool: {},
      aiLinkedCommits: 3,
      totalCommits: 5,
      aiCommitPct: 0.6,
      aiLinesChanged: 72,
      totalLinesChanged: 120,
      aiLinesPct: 0.6,
      avgCostPerCommit: 3.33,
    };
    const output = renderMvpReport({
      current: period,
      previous: { ...period, periodLabel: "previous 7 days" },
      dailyActivity: [],
    });
    assert.ok(output.includes("Previous"));
  });

  it("shows per-tool breakdown when multiple tools present", () => {
    const output = renderMvpReport({
      current: {
        periodLabel: "last 7 days",
        startDate: "2025-04-13",
        endDate: "2025-04-20",
        days: 7,
        sessions: 8,
        turns: 30,
        activeDays: 5,
        estimatedCost: 15,
        byTool: {
          codex: { sessions: 5, turns: 20, estimatedCost: 10 },
          claude: { sessions: 3, turns: 10, estimatedCost: 5 },
        },
        aiLinkedCommits: 4,
        totalCommits: 6,
        aiCommitPct: 0.67,
        aiLinesChanged: 180,
        totalLinesChanged: 250,
        aiLinesPct: 0.72,
        avgCostPerCommit: 3.75,
      },
      previous: null,
      dailyActivity: [],
    });
    assert.ok(output.includes("codex:"));
    assert.ok(output.includes("claude:"));
  });
});
