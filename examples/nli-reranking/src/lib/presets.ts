import type { Preset } from "./types";

export const PRESETS: Preset[] = [
  {
    id: "no-migrate",
    group: "negation",
    label: "Birds that don't migrate",
    fts: "migration migratory winters breeds range resident year-round",
    criteria:
      "is NOT migratory - it stays in the same area all year rather than migrating seasonally",
  },
  {
    id: "drab",
    group: "negation",
    label: "Drab birds, not colorful",
    fts: "plumage bright colorful vivid iridescent red blue yellow green",
    criteria: "is drab and dull-colored - brown, grey or camouflaged, NOT brightly colored",
  },
  {
    id: "not-endangered",
    group: "negation",
    label: "Birds that are doing fine",
    fts: "endangered threatened conservation vulnerable population decline extinction",
    criteria:
      "is NOT of conservation concern - it is common, abundant, and its population is stable or increasing",
  },
  {
    id: "not-water",
    group: "negation",
    label: "Birds that avoid water",
    fts: "water lake river marsh wetland pond aquatic swim shore",
    criteria: "does NOT live near water - it is a bird of dry land, desert or arid open country",
  },
  {
    id: "midwest-colorful",
    group: "compositional",
    label: "Midwest and very colorful",
    fts: "midwest midwestern prairie grassland Illinois Ohio Iowa Michigan Nebraska Kansas Great Plains",
    criteria:
      "lives in the American Midwest, is very colorful with bright vivid plumage, and is still a living species",
  },
  {
    id: "desert-nocturnal",
    group: "compositional",
    label: "Desert birds active at night",
    fts: "desert arid cactus sonoran chihuahuan scrub southwest Arizona",
    criteria: "is active at night rather than during the day",
  },
  {
    id: "coastal-declining",
    group: "compositional",
    label: "Coastal birds in trouble",
    fts: "coastal shore estuary beach colony nesting island seabird",
    criteria: "is threatened or endangered and its population is declining",
  },
  {
    id: "flightless",
    group: "calibration",
    label: "Birds that can't fly",
    fts: "flight flying wings soaring flap aerial wingspan",
    criteria: "is flightless or nearly flightless - it cannot sustain powered flight",
  },
];

/**
 * Below this, no candidate plausibly satisfies the criteria and a top-10 would be noise.
 * The "birds that can't fly" preset exists to exercise this path — the corpus has none.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.25;

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "find",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "its",
  "me",
  "not",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "very",
  "was",
  "which",
  "with",
  "would",
]);

/**
 * Presets ship hand-tuned lexical expansions; free text has none, so we fall back to naive
 * keyword extraction. The UI surfaces the result as an editable field so the gap is visible.
 */
export function ftsFromCriteria(criteria: string): string {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const raw of criteria.toLowerCase().match(/[a-z]+/g) ?? []) {
    if (raw.length < 3 || STOPWORDS.has(raw) || seen.has(raw)) continue;
    seen.add(raw);
    words.push(raw);
  }
  return words.join(" ");
}
