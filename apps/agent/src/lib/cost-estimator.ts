/**
 * AI cost estimation utility.
 * Maps model names to per-token pricing and computes estimated costs.
 */

export const MODEL_PRICING: Readonly<Record<string, { inputPer1MTokens: number; outputPer1MTokens: number }>> = {
  'gemini-2.0-flash': { inputPer1MTokens: 0.10, outputPer1MTokens: 0.40 },
  'claude-haiku-4-5-20251001': { inputPer1MTokens: 0.80, outputPer1MTokens: 4.00 },
  'claude-sonnet-4-5-20250514': { inputPer1MTokens: 3.00, outputPer1MTokens: 15.00 },
  'claude-sonnet-4-20250514': { inputPer1MTokens: 3.00, outputPer1MTokens: 15.00 },
  'claude-opus-4-20250514': { inputPer1MTokens: 15.00, outputPer1MTokens: 75.00 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1MTokens;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1MTokens;
  return parseFloat((inputCost + outputCost).toFixed(6));
}
