import pLimit from "p-limit";
import { withCache } from "./data/cache";
import { researchDueDiligence } from "./due-diligence";
import { rankDueDiligenceResults } from "./due-diligence-leaderboard-ranking";
import type { DueDiligenceLeaderboard } from "../types/domain";

export const DUE_DILIGENCE_LEADERBOARD_UNIVERSE = [
  "MSFT", "NVDA", "AVGO", "MRVL", "ANET",
  "VRT", "ETN", "CEG", "CCJ", "RGTI",
  "IONQ", "LLY", "VRTX", "JPM", "GS",
  "XOM", "CAT", "GE", "RTX", "COST",
  "WMT", "AMZN", "GOOGL", "META", "PLTR",
];

async function loadLeaderboard(): Promise<DueDiligenceLeaderboard> {
  const limit = pLimit(4);
  const researched = await Promise.allSettled(
    DUE_DILIGENCE_LEADERBOARD_UNIVERSE.map((ticker) =>
      limit(() => researchDueDiligence(ticker)),
    ),
  );
  const results = researched.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failed = researched.length - results.length;

  return {
    generatedAt: new Date().toISOString(),
    universeSize: DUE_DILIGENCE_LEADERBOARD_UNIVERSE.length,
    entries: rankDueDiligenceResults(results).slice(0, 25),
    warnings: failed
      ? [`${failed} candidate${failed === 1 ? "" : "s"} could not be refreshed and were omitted.`]
      : [],
  };
}

export async function getDueDiligenceLeaderboard() {
  return (
    await withCache(
      "due-diligence:leaderboard:v1",
      6 * 60 * 60 * 1000,
      loadLeaderboard,
    )
  ).value;
}
