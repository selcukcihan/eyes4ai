import type { PricingEntry } from "../../schema/src/index.js";

export const PRICING_TABLE: Record<string, PricingEntry> = {
  "gpt-5.4": {
    model: "gpt-5.4",
    inputPerMillionUsd: 2.5,
    cachedInputPerMillionUsd: 0.25,
    outputPerMillionUsd: 15,
    inputPerMillionCredits: 62.5,
    cachedInputPerMillionCredits: 6.25,
    outputPerMillionCredits: 375,
    source: "https://developers.openai.com/codex/pricing",
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
    inputPerMillionCredits: 43.75,
    cachedInputPerMillionCredits: 4.375,
    outputPerMillionCredits: 350,
    source: "https://developers.openai.com/codex/pricing",
    toolFeesExcluded: true
  },
  "gpt-5.4-mini": {
    model: "gpt-5.4-mini",
    inputPerMillionUsd: 0.75,
    cachedInputPerMillionUsd: 0.075,
    outputPerMillionUsd: 4.5,
    inputPerMillionCredits: 18.75,
    cachedInputPerMillionCredits: 1.875,
    outputPerMillionCredits: 113,
    source: "https://developers.openai.com/codex/pricing",
    toolFeesExcluded: true
  },
  "gpt-5.2": {
    model: "gpt-5.2",
    inputPerMillionUsd: 1.75,
    cachedInputPerMillionUsd: 0.175,
    outputPerMillionUsd: 14,
    inputPerMillionCredits: 43.75,
    cachedInputPerMillionCredits: 4.375,
    outputPerMillionCredits: 350,
    source: "https://developers.openai.com/codex/pricing",
    toolFeesExcluded: true
  }
};

export function estimateTokenCostUsd(input: {
  model: string;
  inputTokenCount: number;
  outputTokenCount: number;
  cachedTokenCount?: number;
}): {
  estimatedCostUsd?: number;
  estimatedCreditCost?: number;
  costBasis: "token_estimate_only" | "credit_estimate_only" | "token_and_credit_estimate" | "unknown";
} {
  const pricing = PRICING_TABLE[input.model];
  if (!pricing) {
    return { costBasis: "unknown" };
  }

  const cachedInputTokenCount = Math.max(0, input.cachedTokenCount ?? 0);
  const uncachedInputTokenCount = Math.max(0, input.inputTokenCount - cachedInputTokenCount);

  const inputCost = (uncachedInputTokenCount / 1_000_000) * pricing.inputPerMillionUsd;
  const outputCost = (input.outputTokenCount / 1_000_000) * pricing.outputPerMillionUsd;
  const cachedCost = pricing.cachedInputPerMillionUsd === undefined
    ? 0
    : (cachedInputTokenCount / 1_000_000) * pricing.cachedInputPerMillionUsd;

  const estimatedCostUsd = Number((inputCost + outputCost + cachedCost).toFixed(6));

  const inputCredits = pricing.inputPerMillionCredits === undefined
    ? undefined
    : (uncachedInputTokenCount / 1_000_000) * pricing.inputPerMillionCredits;
  const outputCredits = pricing.outputPerMillionCredits === undefined
    ? undefined
    : (input.outputTokenCount / 1_000_000) * pricing.outputPerMillionCredits;
  const cachedCredits = pricing.cachedInputPerMillionCredits === undefined
    ? undefined
    : (cachedInputTokenCount / 1_000_000) * pricing.cachedInputPerMillionCredits;
  const estimatedCreditCost = inputCredits === undefined || outputCredits === undefined
    ? undefined
    : Number(((inputCredits + outputCredits + (cachedCredits ?? 0))).toFixed(6));

  return {
    estimatedCostUsd,
    ...(estimatedCreditCost === undefined ? {} : { estimatedCreditCost }),
    costBasis: estimatedCreditCost === undefined ? "token_estimate_only" : "token_and_credit_estimate"
  };
}
