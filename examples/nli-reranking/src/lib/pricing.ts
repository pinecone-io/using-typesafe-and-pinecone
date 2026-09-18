/**
 * Verified 2026-09-18 against docs.typesafe.ai/models and the claude-api skill's model table.
 * Provider pricing drifts — re-check both sources before quoting these numbers anywhere.
 */
export const PRICING = {
  typesafe: {
    model: "jev-latest",
    inputPerMillion: 0.042,
    outputPerMillion: 0,
  },
  claude: {
    model: process.env.CLAUDE_MODEL ?? "claude-opus-5",
    inputPerMillion: 5.0,
    outputPerMillion: 25.0,
  },
} as const;

export function costOf(
  provider: "typesafe" | "claude",
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[provider];
  return (inputTokens * p.inputPerMillion + outputTokens * p.outputPerMillion) / 1_000_000;
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  return `$${usd.toFixed(4)}`;
}
