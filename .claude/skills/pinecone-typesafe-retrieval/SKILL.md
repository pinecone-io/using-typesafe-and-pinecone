---
name: pinecone-typesafe-retrieval
description: Combine Pinecone retrieval with TypeSafe System One judgments — typed decisions before a query (routing it to the right index, namespace, or retrieval mode; gating whether the corpus can answer it at all) and after it (filtering, grading, reranking candidates). Use when building search or RAG and something must be decided rather than merely matched, especially when intent involves negation, degree, or compound constraints that lexical and embedding similarity cannot express.
---

# Pinecone + TypeSafe: retrieve wide, judge narrow

Pinecone matches. TypeSafe decides. Keep the two jobs separate — retrieval optimizes recall,
judgment optimizes precision — and put a judgment wherever the pipeline needs a decision that
similarity cannot make.

## Ideas for using TypeSafe and Pinecone together

Anywhere a Pinecone call needs filtering, reordering, or a decision — before it or after it.

**Before the query**

- **Route to the right index or namespace.** A `choice` over your indexes, each option described
  by what it holds. Pass the corpus descriptions as state; the model cannot route to a namespace
  it was never told about.
- **Pick the retrieval mode.** Dense, sparse, or full-text is a property of the query, not of the
  app. Exact identifiers and rare proper nouns want lexical or sparse; paraphrased questions want
  dense. One `choice`, and code builds the matching `score_by`.
- **Gate the query against the corpus.** A `noul` over the query plus a description of what the
  index contains, answering "can this corpus answer this at all?". A calibrated no lets you say
  _we don't hold that_ instead of returning the least-bad vectors.

**After the query**

- **Filter, grade, and rerank the results.** Score each candidate against the user's criteria and
  let code apply the threshold. This is the case the rest of this skill works through, and it is
  also how you drop passages that retrieved well but do not support an answer.

Routing and gating are one cheap request against a short query. Reranking is one request per
candidate. A gate that avoids a pointless 200-candidate rerank pays for itself many times over.

## When this pattern earns its place

Reach for it when the criteria contain something similarity cannot represent:

| Intent shape | Example                            | Why retrieval alone fails                                               |
| ------------ | ---------------------------------- | ----------------------------------------------------------------------- |
| **Negation** | "birds that don't migrate"         | BM25 ranks documents that use "migrate" _most_ — the exact opposite set |
| **Degree**   | "very colorful", "unusually large" | Requires reading a description and judging intensity                    |
| **Compound** | "coastal AND declining"            | Lexical OR-semantics match either term                                  |
| **Absence**  | "not endangered"                   | The word appears in both the positive and negative case                 |

Negation is the sharpest demonstration: the retrieval stage is actively _misled_ by the query
term, so the reranked ordering inverts the lexical one rather than merely refining it.

If the criteria are a plain topical match ("hummingbirds"), skip the rerank — retrieval already
answers it and you are paying latency for nothing.

## Stage 1 — retrieve wide

Retrieve far more than you will show. 200 candidates reranked to 10 is a good default: recall is
cheap, and the judgment stage is what decides quality.

```ts
const res = await index.documents.search({
  scoreBy: [
    { type: "text", fields: ["title", "intro", "body"], query: lexicalQuery },
  ],
  topK: 200,
  includeFields: ["title", "intro"],
});
```

Three things that bite:

- **One scoring type per request.** Several `text` or `query_string` clauses may be combined;
  a `dense_vector` or `sparse_vector` clause must appear alone. To mix lexical and vector,
  put the lexical signal in `filter` (`$match_all` / `$match_any` / `$match_phrase`) and let the
  vector clause rank.
- **Field limits are real.** A field over ~10k tokens or 100k bytes is rejected, and a rejected
  document fails its whole batch. Split long text across several searchable fields
  (`body`, `body_overflow`, …) and score across all of them — that preserves recall where
  truncation would silently lose it.
- **Indexing is asynchronous.** A successful upsert does not mean the documents are searchable.
  Poll `documents.search` for a sentinel term before you trust the index.

Ask for only the fields you need. `includeFields` is what bounds the response payload, and the
short field you return is usually the same text you will hand the judge.

## Stage 2 — judge narrow

One TypeSafe request per candidate, all in flight at once. **There is no batch endpoint**;
"batch inference" here means a concurrency pool over independent requests.

```ts
import { TypeSafeClient, noul } from "@typesafe-ai/sdk";

const client = new TypeSafeClient({ retry: { maxRetries: 3 } });

const QUESTION = {
  matches: noul(
    "Does the item described in `snippet` satisfy ALL of the user's stated criteria in `user_criteria`?",
    {
      true: "The item clearly satisfies every part of the stated criteria.",
      false:
        "The item fails to satisfy at least one part of the stated criteria.",
    },
  ),
};

const scored = await pool(candidates, 64, async (c) => {
  const res = await client.systemOne({
    state: { user_criteria: criteria, title: c.title, snippet: c.snippet },
    questions: QUESTION,
  });
  return { ...c, score: res.answers.matches.noul };
});

const top = scored.sort((a, b) => b.score - a.score).slice(0, 10);
```

`noul` returns a calibrated 0–1 probability, which is directly a sort key. Use `score` instead
when you need a graded rubric, and `choice` for unordered categories.

### Why one candidate per request

Each candidate needs its own `state`. Packing many into one request breaks the pattern in two
ways: you approach the per-request state limit, and the scores stop being independent — a
candidate's rating starts depending on its neighbours. Independent requests keep every
probability comparable across the whole set, which is what makes the sort meaningful.

This is the opposite of the **fan-out** pattern, which shares _one_ state across many questions.
Fan-out is right for asking twelve things about one document; it is wrong for asking one thing
about two hundred documents.

## What actually drives cost and latency

Measured on 200 candidates with ~450-token requests (Jev at $0.042/M input, output free):

| Concurrency | Wall clock |
| ----------- | ---------- |
| 16          | ~2.4 s     |
| 32          | ~1.2 s     |
| 64          | ~0.9 s     |

Roughly 90k input tokens per query, about **$0.004**. Scale the arithmetic to your corpus rather
than reusing these numbers. Watch the account rate limit (1,200 req/min) — one 200-candidate
query spends a sixth of a minute's budget, so a busy endpoint needs a queue, not just a pool.

Compare against a single long-context LLM call honestly. That call can reason _across_
candidates, which independent judgments deliberately cannot. Measure both; do not assume the
architecture that is cheaper is also better for your data.

## Getting good judgments

**The snippet is the whole input.** The judge sees only the text you send. Check what you are
actually sending before blaming the model — in this repo, the obvious "first paragraph" rule
returned a Latin binomial or a stray caption for over half the corpus, which would have scored
noise. A snippet that does not describe the thing cannot be judged.

**Template the question; do not let an LLM write it.** Put the user's words verbatim into
`state` behind a fixed instruction wrapper. That keeps the judgment deterministic and, when you
are comparing rerankers, guarantees both receive identical input.

**Handle "nothing matches."** Calibration is a feature: when no candidate satisfies the criteria,
every probability comes back low. Read the top score and render an empty state rather than a
top-10 of non-answers.

```ts
if (!top[0] || top[0].score < 0.25) return { empty: true };
```

Tune that threshold on your own data — a value fitted to one observation is not a threshold.

**Split compound criteria when ranking flattens.** Stacking three constraints into one question
tends to compress every score into a narrow band: honest uncertainty, but poor separation. Ask
one question per dimension and combine the normalized scores in code, where weights stay tunable
without re-running inference.

## Keep policy in code

Raw judgments are reusable; policy is not. Store the probabilities, then let code own thresholds,
weights, and display rules. Changing a weight or a cutoff should not require another inference
pass. Typed output guarantees the shape of an answer, never its truth — validate against your
domain before trusting a threshold in production.

Keep both API keys server-side. In a web app, the retrieval and judgment stages belong in a route
handler, never the browser.
