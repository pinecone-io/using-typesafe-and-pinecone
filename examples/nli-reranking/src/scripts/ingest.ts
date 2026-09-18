import "../lib/env";
import { BODY_FIELDS, loadBirds } from "../lib/corpus";
import { pc, birdsIndex, INDEX_NAME, SCHEMA } from "../lib/pinecone";

const BATCH_SIZE = 50;
const UPSERT_CONCURRENCY = 4;

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function indexExists(): Promise<boolean> {
  const { indexes } = await pc().indexes.list();
  return (indexes ?? []).some((i) => i.name === INDEX_NAME);
}

async function ensureIndex(recreate: boolean): Promise<void> {
  const exists = await indexExists();

  if (exists && recreate) {
    console.log(`Deleting existing index '${INDEX_NAME}'...`);
    await pc().indexes.delete(INDEX_NAME);
    while (await indexExists()) await sleep(2000);
  } else if (exists) {
    console.log(`Index '${INDEX_NAME}' already exists. (Pass --recreate to drop it.)`);
    return;
  }

  console.log(`Creating index '${INDEX_NAME}'...`);
  await pc().indexes.create({
    name: INDEX_NAME,
    schema: SCHEMA as never,
    waitUntilReady: true,
  });
  console.log("Index is ready.");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** FTS indexing is asynchronous — a completed upsert does not mean the documents are searchable. */
async function waitUntilSearchable(probe = "bird", timeoutMs = 300_000): Promise<void> {
  console.log("Waiting for documents to become searchable...");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await birdsIndex().documents.search({
      scoreBy: [{ type: "text", fields: ["body"], query: probe }],
      topK: 1,
      includeFields: [],
    });
    if ((res.matches ?? []).length > 0) {
      console.log("  Data is searchable.");
      return;
    }
    await sleep(5000);
    console.log("  Not yet indexed, retrying...");
  }
  console.warn("WARNING: documents may not be fully indexed after timeout.");
}

async function main(): Promise<void> {
  await ensureIndex(flag("recreate"));
  if (flag("create-only")) {
    console.log("Index created. Re-run without --create-only to ingest.");
    return;
  }

  const all = loadBirds();
  const sample = Number(option("sample") ?? 0);
  const birds = sample > 0 ? all.slice(0, sample) : all;
  console.log(`Ingesting ${birds.length} / ${all.length} birds.`);

  const documents = birds.map((b) => ({
    _id: b.id,
    bird_name: b.name,
    intro: b.intro,
    ...Object.fromEntries(BODY_FIELDS.map((f, i) => [f, b.bodyChunks[i] ?? ""])),
  }));

  const batches = chunk(documents, BATCH_SIZE);
  const index = birdsIndex();
  let upserted = 0;
  let failed = 0;
  let cursor = 0;

  await Promise.all(
    Array.from({ length: UPSERT_CONCURRENCY }, async () => {
      while (true) {
        const i = cursor++;
        const batch = batches[i];
        if (!batch) return;
        try {
          await index.documents.upsert({ documents: batch });
          upserted += batch.length;
        } catch {
          /**
           * A batch is rejected whole, so one oversized document would cost the other 49.
           * Retry singly to isolate the offenders and keep the rest.
           */
          for (const doc of batch) {
            try {
              await index.documents.upsert({ documents: [doc] });
              upserted += 1;
            } catch (err) {
              failed += 1;
              console.error(
                `\n  skipped ${doc._id}: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }
        }
        process.stdout.write(`\r  ${upserted + failed} / ${documents.length}`);
      }
    }),
  );

  console.log(`\nUploaded ${upserted} / ${documents.length} documents (${failed} failed).`);
  if (upserted === 0) throw new Error("All upserts failed — aborting before the search poll.");

  await waitUntilSearchable();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
