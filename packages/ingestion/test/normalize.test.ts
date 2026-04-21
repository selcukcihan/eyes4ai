import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeCodexLogRecord } from "../src/normalize.js";
import { makeLogRecord } from "./helpers.js";

describe("normalizeCodexLogRecord", () => {
  it("normalizes codex.user_prompt to ai.prompt", () => {
    const record = makeLogRecord({
      "event.name": "codex.user_prompt",
      "conversation.id": "sess-1",
      model: "gpt-5.4",
      prompt: "Fix the login bug",
    });
    const event = normalizeCodexLogRecord(record, {});
    assert.ok(event);
    assert.equal(event.type, "ai.prompt");
    assert.equal(event.sessionId, "sess-1");
    assert.equal(event.source.surface, "codex");
    // Prompt should be hashed, not stored raw
    const data = event.data as Record<string, unknown>;
    assert.equal(data.rawPromptStored, false);
    assert.ok(data.promptHash);
    assert.ok((data.promptPreview as string).length > 0);
  });

  it("normalizes codex.tool_result to ai.tool_use.post", () => {
    const record = makeLogRecord({
      "event.name": "codex.tool_result",
      "conversation.id": "sess-1",
      tool_name: "edit_file",
      duration_ms: 150,
      success: true,
    });
    const event = normalizeCodexLogRecord(record, {});
    assert.ok(event);
    assert.equal(event.type, "ai.tool_use.post");
    const data = event.data as Record<string, unknown>;
    assert.equal(data.toolName, "edit_file");
    assert.equal(data.success, true);
    assert.equal(data.observedViaOtel, true);
  });

  it("normalizes codex.sse_event response.completed to ai.usage", () => {
    const record = makeLogRecord({
      "event.name": "codex.sse_event",
      "event.kind": "response.completed",
      "conversation.id": "sess-1",
      model: "gpt-5.4",
      input_token_count: 10000,
      output_token_count: 2000,
      cached_token_count: 3000,
    });
    const event = normalizeCodexLogRecord(record, {});
    assert.ok(event);
    assert.equal(event.type, "ai.usage");
    const data = event.data as Record<string, unknown>;
    assert.equal(data.model, "gpt-5.4");
    assert.equal(data.inputTokenCount, 10000);
    assert.equal(data.outputTokenCount, 2000);
    assert.ok(typeof data.estimatedCostUsd === "number");
  });

  it("normalizes codex.conversation_starts to ai.session.start", () => {
    const record = makeLogRecord({
      "event.name": "codex.conversation_starts",
      "conversation.id": "sess-1",
      model: "gpt-5.4",
      provider_name: "OpenAI",
      reasoning_effort: "medium",
      mcp_servers: "computer-use,codex_apps",
    });
    const event = normalizeCodexLogRecord(record, {});
    assert.ok(event);
    assert.equal(event.type, "ai.session.start");
    const data = event.data as Record<string, unknown>;
    assert.deepEqual(data.mcpServers, ["computer-use", "codex_apps"]);
  });

  it("falls back to codex.raw for unknown event names", () => {
    const record = makeLogRecord({
      "event.name": "codex.some_future_event",
      "conversation.id": "sess-1",
    });
    const event = normalizeCodexLogRecord(record, {});
    assert.ok(event);
    assert.equal(event.type, "codex.raw");
  });

  it("falls back to codex.raw when no event name", () => {
    const record = makeLogRecord({
      "conversation.id": "sess-1",
    });
    const event = normalizeCodexLogRecord(record, {});
    assert.ok(event);
    assert.equal(event.type, "codex.raw");
  });

  it("redacts sensitive attributes in raw fallback", () => {
    const record = makeLogRecord({
      "event.name": "codex.unknown_event",
      "conversation.id": "sess-1",
      "user.email": "secret@example.com",
      "user.account_id": "acct-123",
      prompt: "secret prompt",
    });
    const event = normalizeCodexLogRecord(record, {});
    assert.ok(event);
    const attrs = (event.data as Record<string, unknown>).attributes as Record<string, unknown>;
    assert.equal(attrs["user.email"], undefined);
    assert.equal(attrs["user.account_id"], undefined);
    assert.equal(attrs.prompt, undefined);
  });

  it("uses unknown-session when conversation.id is missing", () => {
    const record = makeLogRecord({
      "event.name": "codex.user_prompt",
      prompt: "test",
    });
    const event = normalizeCodexLogRecord(record, {});
    assert.ok(event);
    assert.equal(event.sessionId, "unknown-session");
  });
});
