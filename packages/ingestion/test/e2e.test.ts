import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { startServer } from "../src/server.js";
import type { OtlpLogsRequest } from "../../schema/src/index.js";

const tmpRoot = path.join("/tmp", `.eyes4ai-e2e-${process.pid}`);
let server: http.Server;
let port: number;

function postOtlp(payload: OtlpLogsRequest): Promise<{ status: number; body: Record<string, unknown> }> {
  const data = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path: "/v1/logs", method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          resolve({ status: res.statusCode!, body });
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function getHealth(): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/health`, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        resolve({ status: res.statusCode!, body });
      });
    }).on("error", reject);
  });
}

async function readTodayEvents(): Promise<string[]> {
  const eventsDir = path.join(tmpRoot, ".eyes4ai", "private", "events");
  const isoDay = new Date().toISOString().slice(0, 10);
  const filePath = path.join(eventsDir, `${isoDay}.jsonl`);
  const content = await readFile(filePath, "utf8");
  return content.trim().split("\n").filter(Boolean);
}

function makeFakeCodexPayload(): OtlpLogsRequest {
  return {
    resourceLogs: [
      {
        resource: {
          attributes: [{ key: "service.name", value: { stringValue: "codex-cli" } }],
        },
        scopeLogs: [
          {
            logRecords: [
              {
                timeUnixNano: String(Date.now() * 1_000_000),
                attributes: [
                  { key: "event.name", value: { stringValue: "codex.user_prompt" } },
                  { key: "conversation.id", value: { stringValue: "codex-e2e-sess" } },
                  { key: "prompt", value: { stringValue: "Fix the bug in main.ts" } },
                  { key: "model", value: { stringValue: "gpt-5.4" } },
                ],
              },
              {
                timeUnixNano: String(Date.now() * 1_000_000),
                attributes: [
                  { key: "event.name", value: { stringValue: "codex.tool_result" } },
                  { key: "conversation.id", value: { stringValue: "codex-e2e-sess" } },
                  { key: "tool_name", value: { stringValue: "apply_patch" } },
                  { key: "success", value: { boolValue: true } },
                  { key: "duration_ms", value: { doubleValue: 200 } },
                ],
              },
              {
                timeUnixNano: String(Date.now() * 1_000_000),
                attributes: [
                  { key: "event.name", value: { stringValue: "codex.sse_event" } },
                  { key: "event.kind", value: { stringValue: "response.completed" } },
                  { key: "conversation.id", value: { stringValue: "codex-e2e-sess" } },
                  { key: "model", value: { stringValue: "gpt-5.4" } },
                  { key: "input_token_count", value: { doubleValue: 5000 } },
                  { key: "output_token_count", value: { doubleValue: 1000 } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function makeFakeClaudePayload(): OtlpLogsRequest {
  return {
    resourceLogs: [
      {
        resource: {
          attributes: [{ key: "service.name", value: { stringValue: "claude-code" } }],
        },
        scopeLogs: [
          {
            logRecords: [
              {
                timeUnixNano: String(Date.now() * 1_000_000),
                attributes: [
                  { key: "event.name", value: { stringValue: "claude_code.user_prompt" } },
                  { key: "session.id", value: { stringValue: "claude-e2e-sess" } },
                  { key: "prompt", value: { stringValue: "Refactor the auth module" } },
                  { key: "model", value: { stringValue: "claude-sonnet-4-6" } },
                ],
              },
              {
                timeUnixNano: String(Date.now() * 1_000_000),
                attributes: [
                  { key: "event.name", value: { stringValue: "claude_code.api_request" } },
                  { key: "session.id", value: { stringValue: "claude-e2e-sess" } },
                  { key: "model", value: { stringValue: "claude-sonnet-4-6" } },
                  { key: "input_tokens", value: { doubleValue: 8000 } },
                  { key: "output_tokens", value: { doubleValue: 2000 } },
                  { key: "cost_usd", value: { doubleValue: 0.054 } },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

describe("E2E: OTel server ingestion", () => {
  beforeEach(async () => {
    await mkdir(tmpRoot, { recursive: true });
    server = startServer(tmpRoot, 0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const addr = server.address() as { port: number };
    port = addr.port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it("health endpoint responds", async () => {
    const { status, body } = await getHealth();
    assert.equal(status, 200);
    assert.equal(body.ok, true);
  });

  it("ingests Codex OTel payload and writes JSONL", async () => {
    const { status, body } = await postOtlp(makeFakeCodexPayload());
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.written, 3);

    const lines = await readTodayEvents();
    assert.equal(lines.length, 3);

    const events = lines.map((l) => JSON.parse(l));
    const prompt = events.find((e: Record<string, unknown>) => e.type === "ai.prompt");
    assert.ok(prompt);
    assert.equal(prompt.source.surface, "codex");
    assert.equal(prompt.sessionId, "codex-e2e-sess");

    const toolUse = events.find((e: Record<string, unknown>) => e.type === "ai.tool_use.post");
    assert.ok(toolUse);
    assert.equal(toolUse.data.toolName, "apply_patch");

    const usage = events.find((e: Record<string, unknown>) => e.type === "ai.usage");
    assert.ok(usage);
    assert.equal(usage.data.model, "gpt-5.4");
    assert.ok(typeof usage.data.estimatedCostUsd === "number");
  });

  it("ingests Claude OTel payload and writes JSONL", async () => {
    const { status, body } = await postOtlp(makeFakeClaudePayload());
    assert.equal(status, 200);
    assert.equal(body.written, 2);

    const lines = await readTodayEvents();
    assert.equal(lines.length, 2);

    const events = lines.map((l) => JSON.parse(l));
    const prompt = events.find((e: Record<string, unknown>) => e.type === "ai.prompt");
    assert.ok(prompt);
    assert.equal(prompt.source.surface, "claude");
    assert.equal(prompt.sessionId, "claude-e2e-sess");
    // Prompt should be hashed, not stored raw
    assert.equal(prompt.data.rawPromptStored, false);
    assert.ok(prompt.data.promptHash);

    const usage = events.find((e: Record<string, unknown>) => e.type === "ai.usage");
    assert.ok(usage);
    assert.equal(usage.data.estimatedCostUsd, 0.054);
  });

  it("handles mixed Codex + Claude payloads in sequence", async () => {
    await postOtlp(makeFakeCodexPayload());
    await postOtlp(makeFakeClaudePayload());

    const lines = await readTodayEvents();
    assert.equal(lines.length, 5); // 3 codex + 2 claude

    const events = lines.map((l) => JSON.parse(l));
    const surfaces = new Set(events.map((e: Record<string, unknown>) => (e as { source: { surface: string } }).source.surface));
    assert.ok(surfaces.has("codex"));
    assert.ok(surfaces.has("claude"));
  });

  it("returns 404 for unknown routes", async () => {
    const { status } = await new Promise<{ status: number }>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/nonexistent`, (res) => {
        res.resume();
        resolve({ status: res.statusCode! });
      }).on("error", reject);
    });
    assert.equal(status, 404);
  });

  it("handles empty payload gracefully", async () => {
    const { status, body } = await postOtlp({});
    assert.equal(status, 200);
    assert.equal(body.written, 0);
  });

  it("rawPromptStored is false for all prompt events", async () => {
    await postOtlp(makeFakeCodexPayload());
    await postOtlp(makeFakeClaudePayload());

    const lines = await readTodayEvents();
    const events = lines.map((l) => JSON.parse(l));
    const prompts = events.filter((e: Record<string, unknown>) => e.type === "ai.prompt");
    assert.ok(prompts.length >= 2);
    for (const p of prompts) {
      assert.equal(p.data.rawPromptStored, false, "rawPromptStored should be false");
      assert.ok(p.data.promptHash, "promptHash should be present");
    }
  });
});
