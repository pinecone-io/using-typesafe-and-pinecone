import fs from "node:fs";
import path from "node:path";
import { EXAMPLE_ROOT } from "./env";
import type { Bird } from "./types";
/**
 * Statically imported so the bundler traces it into the serverless function. A runtime
 * `fs` read of a computed path is not traced, and every photo silently disappears once deployed.
 */
import images from "../../data/images.json";

export const DATA_DIR = process.env.BIRD_DATA_DIR ?? path.join(EXAMPLE_ROOT, "data");

export const SNIPPET_MAX_CHARS = 700;

/**
 * Pinecone FTS rejects a field over 10k tokens or 100k bytes, and the token limit binds first
 * at roughly 40k characters. Long articles are split across these fields instead of truncated,
 * and every one of them is scored, so a term late in a long article still matches.
 * Three chunks covers all but 5 of 2,155 articles.
 */
export const BODY_CHUNK_CHARS = 30_000;
export const BODY_FIELDS = ["body", "body_overflow", "body_overflow_2"] as const;

export function chunkBody(text: string): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < BODY_FIELDS.length; i++) {
    chunks.push(text.slice(i * BODY_CHUNK_CHARS, (i + 1) * BODY_CHUNK_CHARS));
  }
  return chunks;
}

const LEAD_MIN_CHARS = 120;
const LEAD_MIN_WORDS = 12;

export function paragraphs(text: string): string[] {
  return text
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * The reference repo took paragraph[0], but ~55% of these articles open with a bare Latin
 * binomial ("Bucco tectus") or a stray map caption, so reranking on it would score noise.
 */
export function leadParagraph(text: string): string {
  const ps = paragraphs(text);
  for (const p of ps) {
    if (p.length >= LEAD_MIN_CHARS && p.includes(".") && countWords(p) >= LEAD_MIN_WORDS) {
      return p;
    }
  }
  return ps[0] ?? "";
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Slugs come from Wikipedia URLs, so apostrophes arrive percent-encoded (`Baird%27s_trogon`). */
export function displayName(slug: string): string {
  try {
    return decodeURIComponent(slug).replace(/_/g, " ");
  } catch {
    return slug.replace(/_/g, " ");
  }
}

export function snippetOf(text: string): string {
  return leadParagraph(text).slice(0, SNIPPET_MAX_CHARS);
}

/** 76 of 2,155 birds have no photo, so callers must handle a miss. */
export function imageFor(id: string): string | undefined {
  const name = (images as Record<string, string>)[id];
  return name ? `/birds/${name}` : undefined;
}

export function loadBirds(dataDir: string = DATA_DIR): Bird[] {
  const textDir = path.join(dataDir, "text");
  if (!fs.existsSync(textDir)) {
    throw new Error(`No corpus at ${textDir}. Set BIRD_DATA_DIR or copy parsed_birds/text there.`);
  }
  return fs
    .readdirSync(textDir)
    .filter((f) => f.endsWith(".txt"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(textDir, file), "utf8");
      const id = file.replace(/\.txt$/, "");
      const ps = paragraphs(raw);
      const lead = leadParagraph(raw);
      const rest = ps.filter((p) => p !== lead).join("\n\n");
      return { id, name: displayName(id), intro: lead, bodyChunks: chunkBody(rest) };
    });
}
