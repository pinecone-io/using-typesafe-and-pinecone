import { describe, expect, it } from "vitest";
import { SEARCH_FIELDS, SOURCE_TAG, RETRIEVAL_TOP_K } from "./pinecone";
import { BODY_FIELDS } from "./corpus";

describe("SOURCE_TAG", () => {
  /** Pinecone accepts only lowercase letters, numbers, underscores and colons. */
  it("uses only the characters Pinecone allows", () => {
    expect(SOURCE_TAG).toMatch(/^[a-z0-9_:]+$/);
  });

  it("identifies the integration", () => {
    expect(SOURCE_TAG).toContain("typesafe");
    expect(SOURCE_TAG).toContain("pinecone");
  });
});

describe("search fields", () => {
  it("scores every body chunk, so a term late in a long article still matches", () => {
    for (const field of BODY_FIELDS) expect(SEARCH_FIELDS).toContain(field);
  });

  it("includes the name and intro fields", () => {
    expect(SEARCH_FIELDS).toContain("bird_name");
    expect(SEARCH_FIELDS).toContain("intro");
  });
});

describe("RETRIEVAL_TOP_K", () => {
  it("retrieves far more than it displays", () => {
    expect(RETRIEVAL_TOP_K).toBe(200);
  });
});
