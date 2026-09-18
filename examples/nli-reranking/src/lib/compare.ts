import { retrieve } from "./pinecone";
import { rerankWithTypeSafe } from "./rerank-typesafe";
import { claudeAvailable, rerankWithClaude } from "./rerank-claude";
import type { Candidate, ComparisonResult, Query, RerankResult } from "./types";

export type Reranker = "typesafe" | "claude";

export type CompareEvent =
  | { type: "plan"; rerankers: Reranker[] }
  | { type: "retrieval"; candidates: Candidate[]; candidateCount: number; retrievalMs: number }
  | { type: "typesafe"; result: RerankResult }
  | { type: "claude"; result: RerankResult };

/**
 * Sequential, not Promise.all: latency is a headline number, and TypeSafe's 200 concurrent
 * sockets would contend with Claude's request and skew both timings.
 */
export async function* compareStream(query: Query, topN = 10): AsyncGenerator<CompareEvent> {
  const rerankers: Reranker[] = claudeAvailable() ? ["typesafe", "claude"] : ["typesafe"];
  yield { type: "plan", rerankers };

  const { candidates, ms: retrievalMs } = await retrieve(query.fts);

  /**
   * Both rerankers get the same frozen array and the same criteria string. Anything that
   * diverges here — ordering, snippet text, wording — invalidates the comparison.
   */
  const frozen = Object.freeze([...candidates]) as typeof candidates;

  yield {
    type: "retrieval",
    candidates: candidates.slice(0, topN),
    candidateCount: candidates.length,
    retrievalMs,
  };

  yield { type: "typesafe", result: await rerankWithTypeSafe(frozen, query.criteria, topN) };
  if (rerankers.includes("claude")) {
    yield { type: "claude", result: await rerankWithClaude(frozen, query.criteria, topN) };
  }
}

export async function compare(query: Query, topN = 10): Promise<ComparisonResult> {
  const result: Partial<ComparisonResult> = { query };
  for await (const event of compareStream(query, topN)) {
    if (event.type === "plan") continue;
    if (event.type === "retrieval") {
      result.candidates = event.candidates;
      result.candidateCount = event.candidateCount;
      result.retrievalMs = event.retrievalMs;
    } else {
      result[event.type] = event.result;
    }
  }
  return result as ComparisonResult;
}
