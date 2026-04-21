import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeClaudeAttributes } from "../src/normalize-claude.js";

const ts = "2025-04-20T10:00:00.000Z";

describe("normalizeClaudeAttributes", () => {
  it("normalizes claude_code.user_prompt to ai.prompt", () => {
    const event = normalizeClaudeAttributes(
      {
        "event.name": "claude_code.user_prompt",
        "session.id": "claude-sess-1",
        model: "claude-sonnet-4-6",
        prompt: "Fix the login bug",
      },
      ts,
      undefined,
    );
    assert.ok(event);
    assert.equal(event.type, "ai.prompt");
    assert.equal(event.sessionId, "claude-sess-1");
    assert.equal(event.source.surface, "claude");
    assert.equal(event.source.event, "claude_code.user_prompt");
    const data = event.data as Record<string, unknown>;
    assert.equal(data.rawPromptStored, false);
    assert.ok(data.promptHash);
    assert.ok((data.promptPreview as string).length > 0);
    assert.equal(data.model, "claude-sonnet-4-6");
  });

  it("normalizes claude_code.api_request to ai.usage", () => {
    const event = normalizeClaudeAttributes(
      {
        "event.name": "claude_code.api_request",
        "session.id": "claude-sess-1",
        model: "claude-sonnet-4-6",
        input_tokens: 5000,
        output_tokens: 1000,
        cache_read_tokens: 2000,
        cost_usd: 0.05,
      },
      ts,
      undefined,
    );
    assert.ok(event);
    assert.equal(event.type, "ai.usage");
    const data = event.data as Record<string, unknown>;
    assert.equal(data.model, "claude-sonnet-4-6");
    assert.equal(data.inputTokenCount, 5000);
    assert.equal(data.outputTokenCount, 1000);
    assert.equal(data.cachedTokenCount, 2000);
    // Direct cost_usd takes precedence
    assert.equal(data.estimatedCostUsd, 0.05);
    assert.equal(data.costBasis, "token_estimate_only");
  });

  it("falls back to estimated cost when cost_usd is absent", () => {
    const event = normalizeClaudeAttributes(
      {
        "event.name": "claude_code.api_request",
        "session.id": "claude-sess-1",
        model: "claude-sonnet-4-6",
        input_tokens: 1_000_000,
        output_tokens: 1_000_000,
      },
      ts,
      undefined,
    );
    assert.ok(event);
    const data = event.data as Record<string, unknown>;
    // Should use pricing table estimate: input 1M * $3/M + output 1M * $15/M = $18
    assert.equal(data.estimatedCostUsd, 18);
  });

  it("normalizes claude_code.tool_result to ai.tool_use.post", () => {
    const event = normalizeClaudeAttributes(
      {
        "event.name": "claude_code.tool_result",
        "session.id": "claude-sess-1",
        tool_name: "Read",
        duration_ms: 42,
        success: true,
        mcp_server_scope: "filesystem",
      },
      ts,
      undefined,
    );
    assert.ok(event);
    assert.equal(event.type, "ai.tool_use.post");
    const data = event.data as Record<string, unknown>;
    assert.equal(data.toolName, "Read");
    assert.equal(data.durationMs, 42);
    assert.equal(data.success, true);
    assert.equal(data.mcpServer, "filesystem");
    assert.equal(data.observedViaOtel, true);
  });

  it("normalizes claude_code.tool_decision to ai.tool_decision", () => {
    const event = normalizeClaudeAttributes(
      {
        "event.name": "claude_code.tool_decision",
        "session.id": "claude-sess-1",
        tool_name: "Bash",
        decision: "approve",
        source: "auto",
      },
      ts,
      undefined,
    );
    assert.ok(event);
    assert.equal(event.type, "ai.tool_decision");
    const data = event.data as Record<string, unknown>;
    assert.equal(data.toolName, "Bash");
    assert.equal(data.decision, "approve");
    assert.equal(data.decisionSource, "auto");
  });

  it("falls back to raw for unknown Claude events", () => {
    const event = normalizeClaudeAttributes(
      {
        "event.name": "claude_code.some_future_event",
        "session.id": "claude-sess-1",
        foo: "bar",
      },
      ts,
      undefined,
    );
    assert.ok(event);
    assert.equal(event.type, "raw");
    assert.equal(event.source.event, "claude_code.some_future_event");
  });

  it("falls back to raw when no event name", () => {
    const event = normalizeClaudeAttributes(
      { "session.id": "claude-sess-1" },
      ts,
      undefined,
    );
    assert.ok(event);
    assert.equal(event.type, "raw");
    assert.equal(event.source.event, "unknown");
  });

  it("uses unknown-session when session.id is missing", () => {
    const event = normalizeClaudeAttributes(
      { "event.name": "claude_code.user_prompt", prompt: "hi" },
      ts,
      undefined,
    );
    assert.ok(event);
    assert.equal(event.sessionId, "unknown-session");
  });

  it("redacts sensitive attributes in raw fallback", () => {
    const event = normalizeClaudeAttributes(
      {
        "event.name": "claude_code.unknown",
        "session.id": "s1",
        "user.email": "secret@example.com",
        "user.account_id": "acct-123",
        prompt: "secret prompt",
        body: "secret body",
        tool_input: "secret input",
        safe_key: "visible",
      },
      ts,
      undefined,
    );
    assert.ok(event);
    const attrs = (event.data as Record<string, unknown>).attributes as Record<string, unknown>;
    assert.equal(attrs["user.email"], undefined);
    assert.equal(attrs["user.account_id"], undefined);
    assert.equal(attrs.prompt, undefined);
    assert.equal(attrs.body, undefined);
    assert.equal(attrs.tool_input, undefined);
    assert.equal(attrs.safe_key, "visible");
  });

  it("handles string booleans for success field", () => {
    const event = normalizeClaudeAttributes(
      {
        "event.name": "claude_code.tool_result",
        "session.id": "s1",
        tool_name: "Write",
        success: "true",
      },
      ts,
      undefined,
    );
    assert.ok(event);
    const data = event.data as Record<string, unknown>;
    assert.equal(data.success, true);
  });
});
