# using-typesafe-and-pinecone

**[Try the live demo →](https://using-typesafe-and-pinecone.vercel.app/)**

A collection of examples using TypeSafe's Jev model and Pinecone together. Each one is self-contained, with its own `package.json` and its own
deploy, and shares the API keys in the repo-root `.env`.

## Examples

More coming soon! If you have an example, or want to request one, make an Issue or PR!

### [`nli-reranking`](examples/nli-reranking)

Use TypeSafe's Jev with Pinecone to filter out and rerank results in natural language. Great for when you have reranking criteria that aren't quite good enough for normal rerankers, and need high quality specification for each criteria.

Pinecone full-text search retrieves 200 candidates; a TypeSafe judgment reranks them to 10 by
natural-language criteria, alongside a Claude baseline.

![Clicking a preset, prefilling the query, and reranking 200 candidates](examples/nli-reranking/docs/demo.gif)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fpinecone-io%2Fusing-typesafe-and-pinecone&root-directory=examples%2Fnli-reranking&env=PINECONE_API_KEY,TYPESAFE_API_KEY,ANTHROPIC_API_KEY&envDescription=Pinecone%20and%20TypeSafe%20are%20required.%20ANTHROPIC_API_KEY%20is%20optional%20-%20without%20it%20the%20Claude%20column%20stays%20disabled%20and%20the%20rest%20still%20runs.&envLink=https%3A%2F%2Fgithub.com%2Fpinecone-io%2Fusing-typesafe-and-pinecone%2Fblob%2Fmain%2F.env.example&project-name=bird-search-nli-reranking&repository-name=bird-search-nli-reranking)

A fresh deploy starts with an **empty Pinecone index**. Clone the repo, set `PINECONE_API_KEY`, and
run `npm run ingest` once to load the 2,155 bird articles before the deployed app returns results.

## Setup

```bash
cp .env.example .env   # then fill in the keys
```

| Variable            | Required | Used for                                               |
| ------------------- | -------- | ------------------------------------------------------ |
| `PINECONE_API_KEY`  | yes      | Retrieval                                              |
| `TYPESAFE_API_KEY`  | yes      | Reranking judgments                                    |
| `ANTHROPIC_API_KEY` | no       | The Claude baseline column; omit and it stays disabled |

## Running an example

```bash
cd examples/nli-reranking
npm install
npm run ingest   # once, to build and populate the Pinecone index
npm run dev
```

## Working on an example

```bash
npm run check   # typecheck, lint, format, tests — no API calls, no credits spent
```

CI discovers every directory under `examples/` with a `package.json` and runs `check` and `build`
for each, so a new example is picked up with no workflow edit. `node scripts/check-examples.mjs`
runs the same conventions check locally.

Re-record the demo GIF with the dev server running (needs `ffmpeg`):

```bash
npm run record-demo
```

## Agent skills

Use the Pinecone + TypeSafe skill to build TypeSafe into your own Pinecone workflows.
WIP, we're still tweaking this, but let us know what you think!

- [`pinecone-typesafe-retrieval`](.claude/skills/pinecone-typesafe-retrieval) — where a TypeSafe
  judgment fits around a Pinecone call: routing, picking a retrieval mode, gating a query, and
  reranking results.
- [`record-demo-gif`](.claude/skills/record-demo-gif) — recording and re-recording an example's
  demo GIF.
