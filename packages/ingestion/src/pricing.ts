import type { PricingEntry } from "../../schema/src/index.js";

export const PRICING_TABLE: Record<string, PricingEntry> = {
  "gpt-5.4": {
    model: "gpt-5.4",
    inputPerMillionUsd: 2.5,
    cachedInputPerMillionUsd: 0.25,
    outputPerMillionUsd: 15,
    source: "https://developers.openai.com/api/docs/models/gpt-5.4/",
    toolFeesExcluded: true
  },
  "gpt-5.1-codex": {
    model: "gpt-5.1-codex",
    inputPerMillionUsd: 1.25,
    cachedInputPerMillionUsd: 0.125,
    outputPerMillionUsd: 10,
    source: "https://developers.openai.com/api/docs/models/gpt-5.1-codex",
    toolFeesExcluded: true
  },
  "gpt-5.3-codex": {
    model: "gpt-5.3-codex",
    inputPerMillionUsd: 1.75,
    cachedInputPerMillionUsd: 0.175,
    outputPerMillionUsd: 14,
    source: "https://developers.openai.com/api/docs/models/gpt-5.3-codex",
    toolFeesExcluded: true
  },
  "gpt-5.4-mini": {
    model: "gpt-5.4-mini",
    inputPerMillionUsd: 0.75,
    cachedInputPerMillionUsd: 0.075,
    outputPerMillionUsd: 4.5,
    source: "https://developers.openai.com/api/docs/models/gpt-5.4-mini/",
    toolFeesExcluded: true
  }
};

export function estimateTokenCostUsd(input: {
  model: string;
  inputTokenCount: number;
  outputTokenCount: number;
  cachedTokenCount?: number;
}): { estimatedCostUsd?: number; costBasis: "token_estimate_only" | "unknown" } {
  const pricing = PRICING_TABLE[input.model];
  if (!pricing) {
    return { costBasis: "unknown" };
  }

  const inputCost = (input.inputTokenCount / 1_000_000) * pricing.inputPerMillionUsd;
  const outputCost = (input.outputTokenCount / 1_000_000) * pricing.outputPerMillionUsd;
  const cachedCost = pricing.cachedInputPerMillionUsd === undefined
    ? 0
    : ((input.cachedTokenCount ?? 0) / 1_000_000) * pricing.cachedInputPerMillionUsd;

  return {
    estimatedCostUsd: Number((inputCost + outputCost + cachedCost).toFixed(6)),
    costBasis: "token_estimate_only"
  };
}
