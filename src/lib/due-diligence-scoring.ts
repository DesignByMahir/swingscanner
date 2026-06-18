import { clamp, gradeScore } from "./scoring";
import type { DueDiligencePillar } from "../types/domain";

export interface FundamentalScoreInput {
  profitMargin: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  freeCashFlow: number | null;
  totalRevenue: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
}

export interface OutlookScoreInput {
  forwardRevenueGrowth: number | null;
  forwardEarningsGrowth: number | null;
  analystUpside: number | null;
  upwardRevisions: number;
  downwardRevisions: number;
}

export interface FundOutlookScoreInput {
  ytdReturn: number | null;
  threeYearAverageReturn: number | null;
  fiveYearAverageReturn: number | null;
  expenseRatio: number | null;
}

function averageAvailable(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return available.length
    ? available.reduce((sum, value) => sum + value, 0) / available.length
    : null;
}

function weightedAverageAvailable(values: Array<{ value: number | null; weight: number }>) {
  const available = values.filter((item): item is { value: number; weight: number } =>
    item.value !== null && Number.isFinite(item.value),
  );
  if (!available.length) return null;
  const weight = available.reduce((sum, item) => sum + item.weight, 0);
  return available.reduce((sum, item) => sum + item.value * item.weight, 0) / weight;
}

export function scoreFinancials(input: FundamentalScoreInput) {
  const freeCashFlowMargin = input.freeCashFlow !== null && input.totalRevenue
    ? input.freeCashFlow / input.totalRevenue
    : null;
  const score = weightedAverageAvailable([
    { value: input.revenueGrowth === null ? null : clamp((input.revenueGrowth + 0.03) * 260), weight: 30 },
    { value: input.earningsGrowth === null ? null : clamp((input.earningsGrowth + 0.08) * 210), weight: 18 },
    { value: input.profitMargin === null ? null : clamp(45 + input.profitMargin * 180), weight: 18 },
    { value: freeCashFlowMargin === null ? null : clamp(45 + freeCashFlowMargin * 260), weight: 14 },
    { value: input.currentRatio === null ? null : clamp(input.currentRatio * 45), weight: 8 },
    { value: input.debtToEquity === null ? null : clamp(92 - Math.max(0, input.debtToEquity - 40) * 0.45), weight: 12 },
  ]);
  return score === null ? null : Math.round(score);
}

export function scoreOutlook(input: OutlookScoreInput) {
  const revisionTotal = input.upwardRevisions + input.downwardRevisions;
  const revisionScore = revisionTotal
    ? clamp(50 + ((input.upwardRevisions - input.downwardRevisions) / revisionTotal) * 50)
    : null;
  const score = weightedAverageAvailable([
    { value: input.forwardRevenueGrowth === null ? null : clamp((input.forwardRevenueGrowth + 0.05) * 320), weight: 35 },
    { value: input.forwardEarningsGrowth === null ? null : clamp((input.forwardEarningsGrowth + 0.08) * 260), weight: 25 },
    { value: revisionScore, weight: 20 },
    { value: input.analystUpside === null ? null : clamp(50 + input.analystUpside * 160), weight: 20 },
  ]);
  return score === null ? null : Math.round(score);
}

export function scoreFundOutlook(input: FundOutlookScoreInput) {
  const score = averageAvailable([
    input.ytdReturn === null ? null : clamp(50 + input.ytdReturn * 220),
    input.threeYearAverageReturn === null ? null : clamp(35 + input.threeYearAverageReturn * 260),
    input.fiveYearAverageReturn === null ? null : clamp(35 + input.fiveYearAverageReturn * 300),
    input.expenseRatio === null ? null : clamp(100 - input.expenseRatio * 5_000),
  ]);
  return score === null ? null : Math.round(score);
}

export function scoreContracts(contractHeadlineCount: number, relevantHeadlineCount: number) {
  if (!relevantHeadlineCount) return null;
  if (contractHeadlineCount >= 3) return 90;
  if (contractHeadlineCount === 2) return 80;
  if (contractHeadlineCount === 1) return 68;
  return null;
}

export function scoreSector(relative63Day: number | null, above200Day: boolean | null) {
  if (relative63Day === null && above200Day === null) return null;
  const relativeScore = relative63Day === null ? null : clamp(50 + relative63Day * 4);
  const trendScore = above200Day === null ? null : above200Day ? 80 : 30;
  const score = averageAvailable([relativeScore, trendScore]);
  return score === null ? null : Math.round(score);
}

export function aggregateDueDiligenceScore(pillars: DueDiligencePillar[]) {
  const available = pillars.filter(
    (pillar): pillar is DueDiligencePillar & { score: number } => pillar.score !== null,
  );
  if (!available.length) return { score: 0, grade: gradeScore(0) };
  const weight = available.reduce((sum, pillar) => sum + pillar.weight, 0);
  const score = Math.round(
    available.reduce((sum, pillar) => sum + pillar.score * pillar.weight, 0) / weight,
  );
  return { score, grade: gradeScore(score) };
}
