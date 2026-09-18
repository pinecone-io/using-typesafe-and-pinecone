import { describe, expect, it } from "vitest";
import { costOf, formatCost, PRICING } from "./pricing";

describe("costOf", () => {
  it("charges TypeSafe for input only", () => {
    expect(costOf("typesafe", 1_000_000, 1_000_000)).toBeCloseTo(0.042, 6);
  });

  it("charges Claude for input and output", () => {
    expect(costOf("claude", 1_000_000, 1_000_000)).toBeCloseTo(30.0, 6);
  });

  it("is zero for zero tokens", () => {
    expect(costOf("typesafe", 0, 0)).toBe(0);
    expect(costOf("claude", 0, 0)).toBe(0);
  });

  it("scales linearly", () => {
    expect(costOf("claude", 200_000, 0)).toBeCloseTo(costOf("claude", 100_000, 0) * 2, 10);
  });
});

describe("formatCost", () => {
  it("shows more precision for sub-cent amounts", () => {
    expect(formatCost(0.00414)).toBe("$0.00414");
  });

  it("shows four places above a cent", () => {
    expect(formatCost(0.1804)).toBe("$0.1804");
  });

  it("renders zero plainly", () => {
    expect(formatCost(0)).toBe("$0");
  });
});

describe("PRICING", () => {
  it("leaves TypeSafe output free", () => {
    expect(PRICING.typesafe.outputPerMillion).toBe(0);
  });

  it("keeps every rate non-negative", () => {
    for (const p of Object.values(PRICING)) {
      expect(p.inputPerMillion).toBeGreaterThanOrEqual(0);
      expect(p.outputPerMillion).toBeGreaterThanOrEqual(0);
    }
  });
});
