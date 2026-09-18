"use client";

import { useCallback, useEffect, useState } from "react";
import { PRESETS, LOW_CONFIDENCE_THRESHOLD, ftsFromCriteria } from "@/lib/presets";
import type { Candidate, Preset, RankedBird, RerankResult } from "@/lib/types";

interface Article {
  id: string;
  name: string;
  image?: string;
  intro: string;
  body: string;
  gradedChars: number;
}

interface RetrievalState {
  candidates: Candidate[];
  candidateCount: number;
  retrievalMs: number;
}

type StreamEvent =
  | { type: "plan"; rerankers: ("typesafe" | "claude")[] }
  | ({ type: "retrieval" } & RetrievalState)
  | { type: "typesafe"; result: RerankResult }
  | { type: "claude"; result: RerankResult }
  | { type: "error"; message: string };

async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) yield JSON.parse(line) as StreamEvent;
  }
  buffer += decoder.decode();
  if (buffer.trim()) yield JSON.parse(buffer) as StreamEvent;
}

const GROUPS: { key: Preset["group"]; title: string }[] = [
  { key: "negation", title: "Negation" },
  { key: "compositional", title: "Compositional" },
  { key: "calibration", title: "Calibration" },
];

function Column({
  title,
  badges,
  notice,
  items,
  showScore,
  pending,
  onSelect,
}: {
  title: string;
  badges: { text: string; kind?: "bm25" }[];
  notice?: string;
  items: { id?: string; name: string; score?: number; delta?: string; image?: string }[];
  showScore: boolean;
  pending?: boolean;
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="col">
      <h2>{title}</h2>
      <div className="badges">
        {pending ? (
          <span className="badge badge-pending">
            <span className="spinner" aria-hidden="true" />
            working
          </span>
        ) : (
          badges.map((b) => (
            <span key={b.text} className="badge" data-kind={b.kind}>
              {b.text}
            </span>
          ))
        )}
      </div>
      {notice && <div className="notice">{notice}</div>}
      {items.length === 0 ? (
        <ol className="results skeleton" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <li key={i}>
              <span className="thumb thumb-empty" />
              <span className="name" />
            </li>
          ))}
        </ol>
      ) : (
        <ol className="results">
          {items.map((it, i) => (
            <li key={`${it.name}-${i}`}>
              <button
                type="button"
                className="row"
                onClick={() => it.id && onSelect?.(it.id)}
                disabled={!it.id}
              >
                {it.image ? (
                  <img className="thumb" src={it.image} alt="" loading="lazy" />
                ) : (
                  <span className="thumb thumb-empty" aria-hidden="true" />
                )}
                <span className="name">{it.name}</span>
                {it.delta && <span className="delta">{it.delta}</span>}
                {showScore && it.score !== undefined && (
                  <span className="score">{it.score.toFixed(2)}</span>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function rerankItems(r: RerankResult): {
  id: string;
  name: string;
  image?: string;
  score: number;
  delta: string;
}[] {
  return r.ranked.map((b: RankedBird) => ({
    id: b.id,
    name: b.name,
    image: b.image,
    score: b.score,
    delta: b.bm25Rank > 0 ? `#${b.bm25Rank}` : "",
  }));
}

function timingBadges(r: RerankResult): { text: string }[] {
  if (r.unavailable) return [];
  return [{ text: `${r.ms} ms` }, { text: formatCost(r.costUsd) }];
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  return usd < 0.01 ? `$${usd.toFixed(5)}` : `$${usd.toFixed(4)}`;
}

function Reader({
  article,
  loading,
  onClose,
}: {
  article: Article | null;
  loading: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const graded = article?.intro.slice(0, article.gradedChars) ?? "";
  const rest = article?.intro.slice(article.gradedChars) ?? "";

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="reader" role="dialog" aria-label="Article">
        <header>
          <strong>{article?.name ?? "Loading…"}</strong>
          <button type="button" className="close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="reader-body">
          {loading && !article ? (
            <p className="empty">Loading article…</p>
          ) : article ? (
            <>
              {article.image && <img className="reader-img" src={article.image} alt="" />}
              <p className="graded-label">Text TypeSafe graded</p>
              <p className="graded">{graded}</p>
              {rest && <p>{rest}</p>}
              {article.body.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </>
          ) : (
            <p className="empty">Could not load that article.</p>
          )}
        </div>
      </aside>
    </>
  );
}

export default function Page() {
  const [fts, setFts] = useState(PRESETS[0]!.fts);
  const [criteria, setCriteria] = useState(PRESETS[0]!.criteria);
  const [activeId, setActiveId] = useState<string | null>(PRESETS[0]!.id);
  const [retrieval, setRetrieval] = useState<RetrievalState | null>(null);
  const [typesafe, setTypesafe] = useState<RerankResult | null>(null);
  const [claude, setClaude] = useState<RerankResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rerankers, setRerankers] = useState<("typesafe" | "claude")[]>(["typesafe", "claude"]);
  const [article, setArticle] = useState<Article | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);

  function pick(p: Preset) {
    setActiveId(p.id);
    setFts(p.fts);
    setCriteria(p.criteria);
  }

  function editCriteria(value: string) {
    setCriteria(value);
    if (activeId) {
      setActiveId(null);
      setFts(ftsFromCriteria(value));
    }
  }

  async function run() {
    setLoading(true);
    setError(null);
    setRetrieval(null);
    setTypesafe(null);
    setClaude(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fts, criteria }),
      });
      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? "Request failed");
      }
      for await (const event of readNdjson(res.body)) {
        if (event.type === "plan") setRerankers(event.rerankers);
        else if (event.type === "retrieval") setRetrieval(event);
        else if (event.type === "typesafe") setTypesafe(event.result);
        else if (event.type === "claude") setClaude(event.result);
        else if (event.type === "error") throw new Error(event.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const openArticle = useCallback(async (id: string) => {
    setReaderOpen(true);
    setArticle(null);
    setArticleLoading(true);
    try {
      const res = await fetch(`/api/article?id=${encodeURIComponent(id)}`);
      setArticle(res.ok ? ((await res.json()) as Article) : null);
    } catch {
      setArticle(null);
    } finally {
      setArticleLoading(false);
    }
  }, []);

  const closeReader = useCallback(() => setReaderOpen(false), []);

  const lowConfidence =
    typesafe && typesafe.ranked.length > 0 && typesafe.ranked[0]!.score < LOW_CONFIDENCE_THRESHOLD;
  const started = loading || retrieval !== null;

  return (
    <main className="wrap">
      <div className="brand">
        <img className="logomark" src="/pinecone-logomark-black.svg" alt="Pinecone" />
        <h1>Search Birds and Rerank them in Natural Language</h1>
      </div>
      <p className="sub">
        Use Pinecone to search over a corpus of bird Wikipedia pages with full-text, then rerank the
        top 200 results down to 10 with TypeSafe.
      </p>

      <div className="panel">
        {GROUPS.map((g) => (
          <div key={g.key}>
            <div className="group-title">{g.title}</div>
            <div className="chips">
              {PRESETS.filter((p) => p.group === g.key).map((p) => (
                <button
                  key={p.id}
                  className="chip"
                  data-active={activeId === p.id}
                  onClick={() => pick(p)}
                  disabled={loading}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="criteria">
            Criteria — plain English
          </label>
          <textarea
            id="criteria"
            rows={2}
            value={criteria}
            onChange={(e) => editCriteria(e.target.value)}
            placeholder="Describe the bird you want to return. Use statements that can be cleanly delineated by a yes or a no."
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="fts">
            Full-text query — editable
          </label>
          <input
            id="fts"
            type="text"
            value={fts}
            onChange={(e) => {
              setFts(e.target.value);
              setActiveId(null);
            }}
          />
          <p className="hint">
            First, a full-text query is sent to Pinecone. The Wikipedia articles are long, so
            full-text search can match a term anywhere in an article, across every field at once.
            Second, a TypeSafe call takes each result&rsquo;s opening paragraph and grades it
            against the criteria above. That grading score is what reranks the candidate set. We can
            batch the grades because the results are independent and calibrated. No need to rescale
            afterwards.
          </p>
          <p className="hint">
            We compare against a Claude baseline to showcase different kinds of natural-language
            reranking. The Claude baseline can reason between the corpus entries, but is more
            computationally expensive.
          </p>
        </div>

        <button className="run" onClick={run} disabled={loading || !fts.trim() || !criteria.trim()}>
          {loading ? "Running…" : "Run comparison"}
        </button>
      </div>

      <details className="explain">
        <summary>What each column is doing under the hood</summary>

        <div className="explain-body">
          <section>
            <h3>Pinecone FTS (BM25)</h3>
            <p>
              One <code>documents.search</code> call. BM25 scores the full-text query against{" "}
              <code>bird_name</code>, <code>intro</code> and the <code>body</code> fields, and
              returns the top 200 of 2,155 articles. No embeddings are involved anywhere in this
              app.
            </p>
            <p>
              Terms combine with <strong>OR</strong> semantics: an article matching any term
              participates, and rarer terms count for more. That is why this column has good recall
              and poor judgment — it ranks articles that <em>use the words</em>, which for a
              negation is close to the opposite of what was asked.
            </p>
          </section>

          <section>
            <h3>TypeSafe rerank</h3>
            <p>
              200 independent requests to the Jev model, 64 in flight at once — one per candidate.
              Each request carries only that bird&rsquo;s name and snippet plus your criteria, and
              asks a single yes/no question. The answer comes back as a calibrated probability from
              0 to 1, which the app sorts on directly.
            </p>
            <p>
              Because no candidate ever sees another, the scores stay comparable across the whole
              set. When nothing matches, every probability is low and the column says so instead of
              inventing a top 10.
            </p>
          </section>

          <section>
            <h3>Claude rerank</h3>
            <p>
              One request containing all 200 snippets at once, returning the ten best ids as
              structured output. Unlike the per-candidate judgments, Claude sees the whole list and
              can reason <em>across</em> it — a genuine advantage the parallel approach gives up.
            </p>
            <p>
              It pays for that with one long serial call at full token rates, which is what the
              timing and cost badges above each column are measuring.
            </p>
          </section>

          <p className="explain-note">
            The <code>#N</code> beside a reranked result is that bird&rsquo;s original BM25 rank. A
            high number means the reranker pulled it up from deep in the retrieved set.
          </p>
        </div>
      </details>

      {error && <div className="error">{error}</div>}

      {started && (
        <div className="cols" data-count={rerankers.length + 1}>
          <Column
            title="Pinecone FTS (BM25)"
            badges={
              retrieval
                ? [
                    { text: `${retrieval.candidateCount} candidates`, kind: "bm25" as const },
                    { text: `${retrieval.retrievalMs} ms`, kind: "bm25" as const },
                  ]
                : []
            }
            pending={!retrieval}
            items={(retrieval?.candidates ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              image: c.image,
            }))}
            showScore={false}
            onSelect={openArticle}
          />
          <Column
            title="TypeSafe rerank"
            badges={typesafe ? timingBadges(typesafe) : []}
            pending={!typesafe}
            notice={
              typesafe?.unavailable ??
              (lowConfidence ? "No strong matches — try different criteria." : undefined)
            }
            items={typesafe ? rerankItems(typesafe) : []}
            showScore
            onSelect={openArticle}
          />
          {rerankers.includes("claude") && (
            <Column
              title="Claude rerank"
              badges={claude ? timingBadges(claude) : []}
              pending={!claude}
              notice={claude?.unavailable}
              items={claude ? rerankItems(claude) : []}
              showScore={false}
              onSelect={openArticle}
            />
          )}
        </div>
      )}

      {readerOpen && <Reader article={article} loading={articleLoading} onClose={closeReader} />}
    </main>
  );
}
