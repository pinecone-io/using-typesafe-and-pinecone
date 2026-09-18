import { describe, expect, it } from "vitest";
import { PRESETS, LOW_CONFIDENCE_THRESHOLD, ftsFromCriteria } from "./presets";

describe("presets", () => {
  it("has unique ids", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every preset a non-empty query and criteria", () => {
    for (const p of PRESETS) {
      expect(p.fts.trim().length, p.id).toBeGreaterThan(0);
      expect(p.criteria.trim().length, p.id).toBeGreaterThan(0);
      expect(p.label.trim().length, p.id).toBeGreaterThan(0);
    }
  });

  it("covers all three groups", () => {
    const groups = new Set(PRESETS.map((p) => p.group));
    expect(groups).toEqual(new Set(["negation", "compositional", "calibration"]));
  });

  /** The corpus carries extinct species, which satisfy the other clauses and rank highly. */
  it("constrains the midwest preset to living species", () => {
    const midwest = PRESETS.find((p) => p.id === "midwest-colorful");
    expect(midwest?.criteria).toMatch(/living species/i);
  });

  it("keeps the threshold a probability", () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBeGreaterThan(0);
    expect(LOW_CONFIDENCE_THRESHOLD).toBeLessThan(1);
  });
});

describe("ftsFromCriteria", () => {
  it("drops stopwords and short tokens", () => {
    expect(ftsFromCriteria("a bird that is in the midwest")).toBe("bird midwest");
  });

  it("de-duplicates repeated words", () => {
    expect(ftsFromCriteria("colorful colorful plumage")).toBe("colorful plumage");
  });

  it("strips punctuation", () => {
    expect(ftsFromCriteria("desert, arid; scrub!")).toBe("desert arid scrub");
  });

  it("returns empty string for stopwords only", () => {
    expect(ftsFromCriteria("the and of")).toBe("");
  });
});
