export interface Bird {
  id: string;
  name: string;
  intro: string;
  bodyChunks: string[];
}

export interface Candidate {
  id: string;
  name: string;
  snippet: string;
  bm25: number;
  image?: string;
}

export interface RankedBird {
  id: string;
  name: string;
  snippet: string;
  image?: string;
  bm25Rank: number;
  /** Noul probability for TypeSafe; synthesised descending position for Claude, which only returns an order. */
  score: number;
}

export interface RerankResult {
  ranked: RankedBird[];
  ms: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  unavailable?: string;
}

export interface Query {
  fts: string;
  /** Handed verbatim to both rerankers — the fairness contract depends on it being byte-identical. */
  criteria: string;
}

export interface Preset extends Query {
  id: string;
  label: string;
  group: "negation" | "compositional" | "calibration";
}

export interface ComparisonResult {
  query: Query;
  candidates: Candidate[];
  candidateCount: number;
  retrievalMs: number;
  typesafe: RerankResult;
  claude?: RerankResult;
}
