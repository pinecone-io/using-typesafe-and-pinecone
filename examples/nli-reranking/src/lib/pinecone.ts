import { Pinecone } from "@pinecone-database/pinecone";
import type { Candidate } from "./types";
import { BODY_FIELDS, imageFor, SNIPPET_MAX_CHARS } from "./corpus";

export const INDEX_NAME = process.env.PINECONE_INDEX ?? "bird-search-nli";
export const NAMESPACE = "birds";
export const RETRIEVAL_TOP_K = 200;

export const SOURCE_TAG = "typesafe_pinecone_birdsearch";

export const SEARCH_FIELDS = ["bird_name", "intro", ...BODY_FIELDS];

export const SCHEMA = {
  fields: {
    bird_name: { type: "string", fullTextSearch: { language: "en" } },
    intro: { type: "string", fullTextSearch: { language: "en" } },
    ...Object.fromEntries(
      BODY_FIELDS.map((f) => [
        f,
        { type: "string", fullTextSearch: { language: "en", stemming: true } },
      ]),
    ),
  },
};

let client: Pinecone | undefined;

export function pc(): Pinecone {
  if (!client) {
    client = new Pinecone({
      apiKey: requireEnv("PINECONE_API_KEY"),
      sourceTag: SOURCE_TAG,
    });
  }
  return client;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Add it to .env.`);
  return v;
}

export function birdsIndex() {
  return pc().index({ name: INDEX_NAME, namespace: NAMESPACE });
}

export interface Retrieval {
  candidates: Candidate[];
  ms: number;
}

export async function retrieve(ftsQuery: string, topK = RETRIEVAL_TOP_K): Promise<Retrieval> {
  const t0 = Date.now();
  const res = await birdsIndex().documents.search({
    scoreBy: [{ type: "text", fields: SEARCH_FIELDS, query: ftsQuery }],
    topK,
    includeFields: ["bird_name", "intro"],
  });
  const ms = Date.now() - t0;

  const candidates: Candidate[] = (res.matches ?? []).map((m) => ({
    id: String(m._id),
    name: String(m.bird_name ?? m._id),
    snippet: String(m.intro ?? "").slice(0, SNIPPET_MAX_CHARS),
    bm25: m._score ?? 0,
    image: imageFor(String(m._id)),
  }));

  return { candidates, ms };
}
