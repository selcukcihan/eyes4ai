import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeLogRecord } from "../src/normalize-dispatch.js";
import { makeLogRecord } from "./helpers.js";

describe("normalizeLogRecord dispatch", () => {
  it("routes Claude events to Claude normalizer", () => {
    const record = makeLogRecord({
      "event.name": "claude_code.user_prompt",
      "session.id": "claude-sess-1",
      prompt: "hello",
    });
    const resourceAttrs = { "service.name": "claude-code" };
    const event = normalizeLogRecord(record, resourceAttrs);
    assert.ok(event);
    assert.equal(event.type, "ai.prompt");
    assert.equal(event.source.surface, "claude");
  });

  it("routes Codex events to Codex normalizer", () => {
    const record = makeLogRecord({
      "event.name": "codex.user_prompt",
      "conversation.id": "codex-sess-1",
      prompt: "hello",
    });
    const event = normalizeLogRecord(record, {});
    assert.ok(event);
    assert.equal(event.type, "ai.prompt");
    assert.equal(event.source.surface, "codex");
  });

  it("detects Claude by service.name even without event prefix", () => {
    const record = makeLogRecord({
      "event.name": "claude_code.api_request",
      "session.id": "s1",
      model: "claude-sonnet-4-6",
      input_tokens: 100,
      output_tokens: 50,
    });
    const resourceAttrs = { "service.name": "claude-code" };
    const event = normalizeLogRecord(record, resourceAttrs);
    assert.ok(event);
    assert.equal(event.source.surface, "claude");
  });

  it("detects Codex by conversation.id fallback", () => {
    const record = makeLogRecord({
      "event.name": "codex.tool_result",
      "conversation.id": "sess-1",
      tool_name: "apply_patch",
      success: true,
    });
    const event = normalizeLogRecord(record, {});
    assert.ok(event);
    assert.equal(event.source.surface, "codex");
  });

  it("defaults to Codex for unknown events", () => {
    const record = makeLogRecord({
      "event.name": "something.unknown",
      "conversation.id": "sess-1",
    });
    const event = normalizeLogRecord(record, {});
    assert.ok(event);
    // Falls through to Codex normalizer (default)
    assert.equal(event.source.surface, "codex");
  });

  it("Claude takes priority over Codex when both signals present", () => {
    const record = makeLogRecord({
      "event.name": "claude_code.user_prompt",
      "session.id": "s1",
      "conversation.id": "also-present",
      prompt: "test",
    });
    const event = normalizeLogRecord(record, {});
    assert.ok(event);
    assert.equal(event.source.surface, "claude");
  });
});
