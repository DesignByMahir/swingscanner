import type { DailyCandle } from "../../types/domain";
import { clamp } from "../scoring";

export interface SetupGeometry {
  breakoutLevel: number;
  baseLow: number;
  tighteningPercent: number;
  alternateTrigger: number;
  trendlineStartDate: string;
  trendlineStartPrice: number;
  trendlineEndDate: string;
  trendlineEndPrice: number;
  horizontalTouches: number;
  hasDescendingTrendline: boolean;
}

export interface ResistanceCluster {
  level: number;
  touches: number;
  dispersion: number;
}

export function findHorizontalResistance(sample: DailyCandle[], adrDollars: number): ResistanceCluster {
  const tolerance = Math.max(adrDollars * 0.18, (sample.at(-1)?.close ?? 1) * 0.006);
  const candidates = sample.map((bar) => bar.high);
  const clusters = candidates.map((anchor) => {
    const members = candidates.filter((high) => Math.abs(high - anchor) <= tolerance);
    const level = members.reduce((sum, high) => sum + high, 0) / members.length;
    const dispersion = members.reduce((sum, high) => sum + Math.abs(high - level), 0) / members.length;
    return { level, touches: members.length, dispersion };
  });
  const repeated = clusters.filter((cluster) => cluster.touches >= 2);
  const currentPrice = sample.at(-1)?.close ?? 0;
  const actionable = repeated.filter((cluster) =>
    cluster.level >= currentPrice * 0.985 &&
    cluster.level - currentPrice <= adrDollars * 0.85
  );
  return (actionable.length ? actionable : repeated.length ? repeated : clusters).sort((left, right) =>
    right.touches - left.touches ||
    Math.abs(left.level - currentPrice) - Math.abs(right.level - currentPrice) ||
    left.dispersion - right.dispersion ||
    right.level - left.level
  )[0];
}

export function setupGeometry(sample: DailyCandle[], latest: DailyCandle, adrDollars: number): SetupGeometry {
  const resistance = findHorizontalResistance(sample, adrDollars);
  const breakoutLevel = resistance.level;
  const baseLow = Math.min(...sample.map((bar) => bar.low));
  const recent = sample.slice(-Math.min(5, sample.length));
  const prior = sample.slice(0, Math.max(3, sample.length - recent.length));
  const recentRange = Math.max(...recent.map((bar) => bar.high)) - Math.min(...recent.map((bar) => bar.low));
  const priorRange = Math.max(...prior.map((bar) => bar.high)) - Math.min(...prior.map((bar) => bar.low));
  const tighteningPercent = clamp((1 - recentRange / Math.max(priorRange, recentRange, 0.01)) * 100);
  const split = Math.max(2, Math.floor(sample.length / 2));
  const firstHalf = sample.slice(0, split);
  const secondHalf = sample.slice(split);
  const firstPivot = firstHalf.reduce((best, bar, index) => bar.high > best.bar.high ? { bar, index } : best, { bar: firstHalf[0], index: 0 });
  const secondPivot = secondHalf.reduce((best, bar, index) => bar.high > best.bar.high ? { bar, index: index + split } : best, { bar: secondHalf[0], index: split });
  const distance = Math.max(1, secondPivot.index - firstPivot.index);
  const slope = (secondPivot.bar.high - firstPivot.bar.high) / distance;
  const projected = firstPivot.bar.high + slope * (sample.length - firstPivot.index);
  const hasDescendingTrendline =
    slope < -Math.max(adrDollars * 0.015, latest.close * 0.0005) &&
    projected >= latest.close - adrDollars * 0.25 &&
    projected <= breakoutLevel;
  const trendlineEndPrice = hasDescendingTrendline
    ? Math.min(breakoutLevel, Math.max(baseLow, projected))
    : breakoutLevel;
  const alternateTrigger = hasDescendingTrendline
    ? Math.min(breakoutLevel, trendlineEndPrice + adrDollars * 0.05)
    : breakoutLevel;

  return {
    breakoutLevel,
    baseLow,
    tighteningPercent,
    alternateTrigger,
    trendlineStartDate: firstPivot.bar.date,
    trendlineStartPrice: firstPivot.bar.high,
    trendlineEndDate: latest.date,
    trendlineEndPrice,
    horizontalTouches: resistance.touches,
    hasDescendingTrendline,
  };
}
