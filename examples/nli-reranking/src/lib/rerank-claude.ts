import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Candidate, RankedBird, RerankResult } from "./types";
import { costOf, PRICING } from "./pricing";

const TopTen = z.object({
  top_ids: z
    .array(z.string())
    .describe("Candidate ids, best match first, most 10 entries, drawn only from the list given."),
});

let client: Anthropic | undefined;

function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

function buildPrompt(candidates: Candidate[], criteria: string): string {
  const list = candidates.map((c) => `[${c.id}] ${c.name}\n${c.snippet}`).join("\n\n");
  return [
    `A user is searching a bird encyclopedia. They want birds matching this criteria:`,
    ``,
    criteria,
    ``,
    `Here are ${candidates.length} candidate birds. Rank them and return the ids of the 10 that best satisfy the criteria, best first.`,
    `Use only ids from this list. If fewer than 10 genuinely satisfy the criteria, return only those.`,
    ``,
    list,
  ].join("\n");
}

export function claudeAvailable(): boolean {
  if (process.env.CLAUDE_BASELINE === "off") return false;
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function rerankWithClaude(
  candidates: Candidate[],
  criteria: string,
  topN = 10,
): Promise<RerankResult> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return empty("Set ANTHROPIC_API_KEY to enable the Claude baseline.");
  }

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const bm25Rank = new Map(candidates.map((c, i) => [c.id, i + 1]));
  const t0 = Date.now();

  try {
    const res = await anthropic().beta.messages.parse({
      model: PRICING.claude.model,
      max_tokens: 16000,
      output_config: {
        format: betaZodOutputFormat(TopTen),
        effort: "low",
      },
      messages: [{ role: "user", content: buildPrompt(candidates, criteria) }],
    });
    const ms = Date.now() - t0;

    const ids: string[] = res.parsed_output?.top_ids ?? [];
    const ranked: RankedBird[] = ids
      .map((id) => byId.get(id))
      .filter((c): c is Candidate => Boolean(c))
      .slice(0, topN)
      .map((c, i, arr) => ({
        id: c.id,
        name: c.name,
        snippet: c.snippet,
        image: c.image,
        bm25Rank: bm25Rank.get(c.id) ?? 0,
        score: (arr.length - i) / arr.length,
      }));

    const inputTokens = res.usage.input_tokens;
    const outputTokens = res.usage.output_tokens;
    return {
      ranked,
      ms,
      inputTokens,
      outputTokens,
      costUsd: costOf("claude", inputTokens, outputTokens),
    };
  } catch (err) {
    return empty(err instanceof Error ? err.message : String(err));
  }
}

function empty(unavailable: string): RerankResult {
  return { ranked: [], ms: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, unavailable };
}
