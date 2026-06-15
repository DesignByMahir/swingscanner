import { describe, expect, it } from "vitest";
import { rankDueDiligenceResults } from "../src/lib/due-diligence-leaderboard-ranking";
import type { DueDiligenceResult } from "../src/types/domain";

function result(ticker: string, overallScore: number): DueDiligenceResult {
  return {
    ticker,
    company: ticker,
    instrumentType: "EQUITY",
    researchedAt: "2026-06-15T00:00:00.000Z",
    provider: "test",
    businessSummary: "",
    website: null,
    sector: "Technology",
    industry: "Semiconductors",
    sectorTicker: "XLK",
    overallScore,
    grade: "A",
    verdict: "",
    metrics: [],
    pillars: [
      { id: "financials", label: "Financials", score: overallScore - 5, weight: 35, summary: "", evidence: [] },
      { id: "outlook", label: "Outlook", score: overallScore, weight: 30, summary: "", evidence: [] },
      { id: "contracts", label: "Contracts", score: null, weight: 15, summary: "", evidence: [] },
      { id: "sector", label: "Sector", score: overallScore - 10, weight: 20, summary: "", evidence: [] },
    ],
    bullCase: [],
    risks: [],
    news: [],
    warnings: [],
  };
}

describe("due diligence leaderboard", () => {
  it("ranks the strongest available reports first and labels their best pillar", () => {
    const ranked = rankDueDiligenceResults([
      result("MRVL", 82),
      result("RGTI", 68),
      result("NVDA", 91),
    ]);
    expect(ranked.map((entry) => entry.ticker)).toEqual(["NVDA", "MRVL", "RGTI"]);
    expect(ranked[0]).toMatchObject({
      rank: 1,
      strongestPillar: "Outlook",
      strongestPillarScore: 91,
    });
  });
});
