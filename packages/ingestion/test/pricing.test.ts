import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateTokenCostUsd, PRICING_TABLE } from "../src/pricing.js";

describe("estimateTokenCostUsd", () => {
  it("returns unknown for unrecognized models", () => {
    const result = estimateTokenCostUsd({
      model: "nonexistent-model",
      inputTokenCount: 1000,
      outputTokenCount: 500,
    });
    assert.equal(result.costBasis, "unknown");
    assert.equal(result.estimatedCostUsd, undefined);
  });

  it("computes cost for gpt-5.4 with no cache", () => {
    const result = estimateTokenCostUsd({
      model: "gpt-5.4",
      inputTokenCount: 1_000_000,
      outputTokenCount: 1_000_000,
    });
    // input: 1M * $2.5/M = $2.5, output: 1M * $15/M = $15
    assert.equal(result.costBasis, "token_and_credit_estimate");
    assert.equal(result.estimatedCostUsd, 17.5);
  });

  it("accounts for cached tokens", () => {
    const result = estimateTokenCostUsd({
      model: "gpt-5.4",
      inputTokenCount: 1_000_000,
      outputTokenCount: 0,
      cachedTokenCount: 800_000,
    });
    // uncached: 200k * $2.5/M = $0.5, cached: 800k * $0.25/M = $0.2
    assert.equal(result.estimatedCostUsd, 0.7);
  });

  it("computes cost for claude-sonnet-4-6", () => {
    const result = estimateTokenCostUsd({
      model: "claude-sonnet-4-6",
      inputTokenCount: 1_000_000,
      outputTokenCount: 1_000_000,
    });
    // input: 1M * $3/M = $3, output: 1M * $15/M = $15
    assert.equal(result.costBasis, "token_estimate_only");
    assert.equal(result.estimatedCostUsd, 18);
    assert.equal(result.estimatedCreditCost, undefined);
  });

  it("handles zero tokens", () => {
    const result = estimateTokenCostUsd({
      model: "gpt-5.4",
      inputTokenCount: 0,
      outputTokenCount: 0,
    });
    assert.equal(result.estimatedCostUsd, 0);
  });

  it("cachedTokenCount does not exceed inputTokenCount", () => {
    // If cachedTokenCount > inputTokenCount, uncached should be 0
    const result = estimateTokenCostUsd({
      model: "gpt-5.4",
      inputTokenCount: 100,
      outputTokenCount: 0,
      cachedTokenCount: 500,
    });
    // uncached = max(0, 100 - 500) = 0, cached = 500
    assert.ok(result.estimatedCostUsd! >= 0);
  });
});

describe("PRICING_TABLE", () => {
  it("has entries for all expected Codex models", () => {
    for (const model of ["gpt-5.4", "gpt-5.1-codex", "gpt-5.3-codex", "gpt-5.4-mini", "gpt-5.2"]) {
      assert.ok(PRICING_TABLE[model], `Missing pricing for ${model}`);
    }
  });

  it("has entries for Claude models", () => {
    for (const model of ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"]) {
      assert.ok(PRICING_TABLE[model], `Missing pricing for ${model}`);
    }
  });

  it("all entries have positive pricing values", () => {
    for (const [model, entry] of Object.entries(PRICING_TABLE)) {
      assert.ok(entry.inputPerMillionUsd > 0, `${model} inputPerMillionUsd must be positive`);
      assert.ok(entry.outputPerMillionUsd > 0, `${model} outputPerMillionUsd must be positive`);
    }
  });
});
