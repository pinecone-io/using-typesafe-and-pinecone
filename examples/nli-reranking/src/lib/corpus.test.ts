import { describe, expect, it } from "vitest";
import { displayName, leadParagraph, loadBirds, snippetOf, SNIPPET_MAX_CHARS } from "./corpus";

describe("displayName", () => {
  it("decodes percent-encoded apostrophes from Wikipedia slugs", () => {
    expect(displayName("Baird%27s_trogon")).toBe("Baird's trogon");
    expect(displayName("Swainson%27s_hawk")).toBe("Swainson's hawk");
  });

  it("leaves ordinary slugs alone", () => {
    expect(displayName("Scarlet_tanager")).toBe("Scarlet tanager");
  });

  it("survives a malformed percent sequence", () => {
    expect(displayName("Bad%ZZ_bird")).toBe("Bad%ZZ bird");
  });
});

describe("leadParagraph", () => {
  it("skips a bare Latin binomial", () => {
    const text = [
      "Bucco tectus",
      "The pied puffbird (Notharchus tectus) is a species of bird in the family Bucconidae found across northern South America and parts of Central America.",
    ].join("\n\n");
    expect(leadParagraph(text)).toMatch(/^The pied puffbird/);
  });

  it("skips a stray map caption", () => {
    const text = [
      "Note: distribution on Hispaniola and Puerto Rico not shown",
      "Piranga erythromelas",
      "The scarlet tanager (Piranga olivacea) is a medium-sized American songbird that breeds in eastern North America and winters in South America.",
    ].join("\n\n");
    expect(leadParagraph(text)).toMatch(/^The scarlet tanager/);
  });

  it("falls back to the first paragraph when nothing qualifies", () => {
    expect(leadParagraph("Short stub")).toBe("Short stub");
  });

  it("returns empty string for empty input", () => {
    expect(leadParagraph("")).toBe("");
  });
});

describe("snippetOf", () => {
  it("caps the snippet length", () => {
    const long = `${"word ".repeat(400)}.`;
    expect(snippetOf(long).length).toBeLessThanOrEqual(SNIPPET_MAX_CHARS);
  });
});

describe("corpus", () => {
  const birds = loadBirds();

  it("loads the full corpus", () => {
    expect(birds.length).toBeGreaterThan(2000);
  });

  /** The reference repo's paragraph[0] split produced junk for ~55% of articles; this guards the fix. */
  it("recovers real prose for all but a handful of articles", () => {
    const stubs = birds.filter((b) => b.intro.length < 120);
    expect(stubs.length).toBeLessThanOrEqual(15);
  });

  it("leaves no percent-encoding in display names", () => {
    expect(birds.filter((b) => b.name.includes("%"))).toHaveLength(0);
  });
});
