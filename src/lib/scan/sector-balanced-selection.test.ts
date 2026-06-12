import { describe, expect, it } from "vitest";
import { selectSectorBalanced } from "./sector-balanced-selection";

const ranked = [
  { ticker: "T1", sector: "Technology" },
  { ticker: "T2", sector: "Technology" },
  { ticker: "T3", sector: "Technology" },
  { ticker: "T4", sector: "Technology" },
  { ticker: "F1", sector: "Financials" },
  { ticker: "I1", sector: "Industrials" },
  { ticker: "R1", sector: "Real Estate" },
  { ticker: "F2", sector: "Financials" },
  { ticker: "I2", sector: "Industrials" },
  { ticker: "R2", sector: "Real Estate" },
];

describe("selectSectorBalanced", () => {
  it("preserves the strongest names and reserves representation across sectors", () => {
    const result = selectSectorBalanced(
      ranked,
      ["Technology", "Financials", "Industrials", "Real Estate"],
      { limit: 8, preserveTop: 2, reservePerSector: 1, maxPerSector: 3 },
    );

    expect(result.slice(0, 2).map((item) => item.ticker)).toEqual(["T1", "T2"]);
    expect(new Set(result.map((item) => item.sector))).toEqual(
      new Set(["Technology", "Financials", "Industrials", "Real Estate"]),
    );
    expect(result.filter((item) => item.sector === "Technology")).toHaveLength(3);
  });

  it("fills unused capacity when a sector has no qualifying candidates", () => {
    const result = selectSectorBalanced(
      ranked.slice(0, 6),
      ["Technology", "Financials", "Industrials", "Real Estate"],
      { limit: 6, preserveTop: 1, reservePerSector: 2, maxPerSector: 2 },
    );

    expect(result).toHaveLength(6);
    expect(result.map((item) => item.ticker)).toContain("I1");
  });
});
