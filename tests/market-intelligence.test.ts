import { describe, expect, it } from "vitest";
import { ALL_SECTORS } from "../src/lib/data/sector-catalog";
import { changePercent } from "../src/lib/scan/indicators";

describe("sector performance calculations", () => {
  it("calculates multi-session returns from completed closes", () => {
    const closes = [100, 102, 101, 105, 110, 115];
    expect(changePercent(closes, 1)).toBeCloseTo(4.545, 2);
    expect(changePercent(closes, 5)).toBeCloseTo(15, 6);
  });

  it("returns zero when a requested lookback is unavailable", () => {
    expect(changePercent([100, 101], 5)).toBe(0);
  });

  it("keeps every major S&P sector available to scanner filters", () => {
    expect(ALL_SECTORS).toHaveLength(11);
    expect(ALL_SECTORS.map((item) => item.sector)).toEqual(expect.arrayContaining([
      "Consumer Staples",
      "Industrials",
      "Real Estate",
      "Financials",
      "Technology",
    ]));
  });
});
