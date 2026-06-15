import type {
  DueDiligenceLeaderboardEntry,
  DueDiligenceResult,
} from "../types/domain";

export function rankDueDiligenceResults(
  results: DueDiligenceResult[],
): DueDiligenceLeaderboardEntry[] {
  return [...results]
    .sort((left, right) =>
      right.overallScore - left.overallScore ||
      left.ticker.localeCompare(right.ticker),
    )
    .map((result, index) => {
      const strongest = [...result.pillars]
        .filter((pillar) => pillar.score !== null)
        .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];
      return {
        rank: index + 1,
        ticker: result.ticker,
        company: result.company,
        sector: result.sector,
        industry: result.industry,
        overallScore: result.overallScore,
        grade: result.grade,
        verdict: result.verdict,
        strongestPillar: strongest?.label ?? "Insufficient data",
        strongestPillarScore: strongest?.score ?? null,
      };
    });
}
