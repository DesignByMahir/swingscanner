import { describe, expect, it } from "vitest";
import {
  aggregateDueDiligenceScore,
  scoreContracts,
  scoreFinancials,
  scoreFundOutlook,
  scoreOutlook,
  scoreSector,
} from "../src/lib/due-diligence-scoring";

describe("due diligence scoring", () => {
  it("rewards profitable growth and cash generation", () => {
    const strong = scoreFinancials({
      profitMargin: 0.24,
      revenueGrowth: 0.18,
      earningsGrowth: 0.22,
      freeCashFlow: 24_000_000_000,
      totalRevenue: 100_000_000_000,
      currentRatio: 1.5,
      debtToEquity: 45,
    });
    const weak = scoreFinancials({
      profitMargin: -0.12,
      revenueGrowth: -0.08,
      earningsGrowth: -0.2,
      freeCashFlow: -2_000_000_000,
      totalRevenue: 20_000_000_000,
      currentRatio: 0.5,
      debtToEquity: 220,
    });
    expect(strong).toBeGreaterThan(weak!);
    expect(strong).toBeGreaterThanOrEqual(70);
  });

  it("treats high revenue growth as investable evidence even before full profitability", () => {
    const growthStock = scoreFinancials({
      profitMargin: -0.04,
      revenueGrowth: 0.34,
      earningsGrowth: null,
      freeCashFlow: -150_000_000,
      totalRevenue: 1_500_000_000,
      currentRatio: 1.8,
      debtToEquity: 70,
    });
    const stagnantProfiler = scoreFinancials({
      profitMargin: 0.12,
      revenueGrowth: -0.02,
      earningsGrowth: -0.04,
      freeCashFlow: 100_000_000,
      totalRevenue: 2_000_000_000,
      currentRatio: 1.1,
      debtToEquity: 40,
    });
    expect(growthStock).toBeGreaterThan(stagnantProfiler!);
    expect(growthStock).toBeGreaterThanOrEqual(55);
  });

  it("uses estimates, target context, and revisions for outlook", () => {
    expect(scoreOutlook({
      forwardRevenueGrowth: 0.14,
      forwardEarningsGrowth: 0.2,
      analystUpside: 0.18,
      upwardRevisions: 12,
      downwardRevisions: 2,
    })).toBeGreaterThan(70);
  });

  it("does not invent a contracts score without coverage", () => {
    expect(scoreContracts(0, 0)).toBeNull();
    expect(scoreContracts(0, 8)).toBeNull();
    expect(scoreContracts(2, 8)).toBe(80);
  });

  it("scores fund outlook from returns and recurring cost", () => {
    expect(scoreFundOutlook({
      ytdReturn: 0.09,
      threeYearAverageReturn: 0.18,
      fiveYearAverageReturn: 0.13,
      expenseRatio: 0.0009,
    })).toBeGreaterThan(70);
  });

  it("normalizes the total around available pillars", () => {
    const aggregate = aggregateDueDiligenceScore([
      { id: "financials", label: "Financials", score: null, weight: 35, summary: "", evidence: [] },
      { id: "outlook", label: "Outlook", score: 80, weight: 30, summary: "", evidence: [] },
      { id: "contracts", label: "Contracts", score: 60, weight: 15, summary: "", evidence: [] },
      { id: "sector", label: "Sector", score: 70, weight: 20, summary: "", evidence: [] },
    ]);
    expect(aggregate.score).toBe(72);
    expect(scoreSector(8, true)).toBeGreaterThan(70);
  });
});
