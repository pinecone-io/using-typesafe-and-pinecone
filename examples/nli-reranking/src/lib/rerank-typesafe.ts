import { TypeSafeClient, noul } from "@typesafe-ai/sdk";
import type { Candidate, RankedBird, RerankResult } from "./types";
import { costOf, PRICING } from "./pricing";

export const DEFAULT_CONCURRENCY = Number(process.env.TYPESAFE_CONCURRENCY ?? 64);

const QUESTION = {
  matches: noul(
    "Does the bird described in `bird_snippet` satisfy ALL of the user's stated criteria in `user_criteria`?",
    {
      true: "The bird clearly satisfies every part of the stated criteria.",
      false: "The bird fails to satisfy at least one part of the stated criteria.",
    },
  ),
};

let client: TypeSafeClient | undefined;

function typesafe(): TypeSafeClient {
  if (!client) client = new TypeSafeClient({ retry: { maxRetries: 3 } });
  return client;
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function rerankWithTypeSafe(
  candidates: Candidate[],
  criteria: string,
  topN = 10,
  concurrency = DEFAULT_CONCURRENCY,
): Promise<RerankResult> {
  if (!process.env.TYPESAFE_API_KEY) {
    return empty("TYPESAFE_API_KEY is not set.");
  }

  const bm25Rank = new Map(candidates.map((c, i) => [c.id, i + 1]));
  const t0 = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;

  const scored = await pool(candidates, concurrency, async (c) => {
    const res = await typesafe().systemOne({
      state: { user_criteria: criteria, bird_name: c.name, bird_snippet: c.snippet },
      questions: QUESTION,
      model: PRICING.typesafe.model,
    });
    inputTokens += res.usage.input_tokens;
    outputTokens += res.usage.output_tokens;
    return { ...c, score: res.answers.matches.noul };
  });

  const ms = Date.now() - t0;
  const ranked: RankedBird[] = [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((c) => ({
      id: c.id,
      name: c.name,
      snippet: c.snippet,
      image: c.image,
      bm25Rank: bm25Rank.get(c.id) ?? 0,
      score: c.score,
    }));

  return {
    ranked,
    ms,
    inputTokens,
    outputTokens,
    costUsd: costOf("typesafe", inputTokens, outputTokens),
  };
}

function empty(unavailable: string): RerankResult {
  return { ranked: [], ms: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, unavailable };
}
