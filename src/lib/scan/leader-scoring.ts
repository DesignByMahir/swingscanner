import type {
  DailyCandle,
  ExtensionLabel,
  SetupLabel,
  SetupType,
} from "../../types/domain";
import { clamp, extensionLabel } from "../scoring";
import {
  adr,
  averageVolume,
  changePercent,
  distancePercent,
  ema,
} from "./indicators";

export interface BenchmarkReturns {
  spy5: number;
  spy20: number;
  spy63: number;
  qqq5: number;
  qqq20: number;
  qqq63: number;
}

export interface SectorContext {
  score: number;
  rank: number;
  change1d: number;
  change5d: number;
  change20d: number;
  relative20d: number;
}

export interface LeaderEvidence {
  setup: SetupType;
  setupLabel: SetupLabel;
  canonicalTheme: string;
  marketLeadershipScore: number;
  themeScore: number;
  weeklyTrendScore: number;
  dailySetupScore: number;
  tradabilityScore: number;
  finalScore: number;
  scoreCap: number;
  capReasons: string[];
  relative5Spy: number;
  relative5Qqq: number;
  relative20Spy: number;
  relative20Qqq: number;
  relative63Spy: number;
  relative63Qqq: number;
  weekEma8: number;
  weekEma21: number;
  distanceWeek8: number;
  weeklyTrendHealthy: boolean;
  outperformingMarket: boolean;
  strongTheme: boolean;
  peerStrengthCount: number;
  extensionRisk: number;
  extension: ExtensionLabel;
  setupQuality: number;
  dailyClosePosition: number;
  breakoutLevel: number;
  support: number;
  baseLow: number;
  baseDays: number;
  tighteningPercent: number;
  pullbackVolumeRatio: number;
  bounceVolumeRatio: number;
  heavySellingBelowWeek8: boolean;
  reasons: string[];
}

export function weeklyCandles(candles: DailyCandle[]) {
  const groups = new Map<string, DailyCandle[]>();
  for (const candle of candles) {
    const date = new Date(`${candle.date}T00:00:00Z`);
    const day = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
    const key = date.toISOString().slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), candle]);
  }
  return [...groups.entries()].map(([date, bars]) => ({
    date,
    open: bars[0].open,
    high: Math.max(...bars.map((bar) => bar.high)),
    low: Math.min(...bars.map((bar) => bar.low)),
    close: bars.at(-1)!.close,
    volume: bars.reduce((sum, bar) => sum + bar.volume, 0),
  }));
}

export function classifyMarketTheme(ticker: string, company: string, industry: string) {
  const value = `${ticker} ${company} ${industry}`.toLowerCase();
  const normalizedTicker = ticker.toUpperCase();
  if (["AMD", "AMAT", "AMKR", "ASML", "AVGO", "CRDO", "KLAC", "LRCX", "MRVL", "MU", "NVDA", "QCOM", "TSM", "VECO"].includes(normalizedTicker)) return "Semiconductors";
  if (/semiconductor|chip|microelectronic|optoelectronic|wafer|silicon|photonic/.test(value)) return "Semiconductors";
  if (/data center|server|networking|optical|fiber|power solution|cooling/.test(value)) return "Data Centers";
  if (/\bai\b|artificial intelligence|machine learning|analytics platform/.test(value)) return "Artificial Intelligence";
  if (/nuclear|uranium|reactor/.test(value)) return "Nuclear";
  if (/quantum/.test(value)) return "Quantum Computing";
  if (/robot|automation|autonomous|drone/.test(value)) return "Robotics & Autonomy";
  if (/crypto|bitcoin|blockchain|digital asset/.test(value)) return "Crypto";
  if (/defense|aerospace|missile|space technology/.test(value)) return "Defense & Space";
  if (/biotech|therapeutic|pharma|genomic|biologic/.test(value)) return "Biotechnology";
  if (/cyber|cloud|software|database|digital platform/.test(value)) return "Software & Cloud";
  return industry;
}

function closePosition(candle: DailyCandle) {
  return (candle.close - candle.low) / Math.max(candle.high - candle.low, 0.01);
}

function rangePercent(sample: DailyCandle[], price: number) {
  return (
    (Math.max(...sample.map((bar) => bar.high)) -
      Math.min(...sample.map((bar) => bar.low))) /
    price *
    100
  );
}

export function scoreLeaderEvidence({
  ticker,
  company,
  industry,
  candles,
  benchmarks,
  sector,
  peerStrengthCount = 0,
  optionsTradabilityScore = null,
  optionSpreadDollars = null,
}: {
  ticker: string;
  company: string;
  industry: string;
  candles: DailyCandle[];
  benchmarks: BenchmarkReturns;
  sector: SectorContext;
  peerStrengthCount?: number;
  optionsTradabilityScore?: number | null;
  optionSpreadDollars?: number | null;
}): LeaderEvidence | null {
  if (candles.length < 205) return null;
  const latest = candles.at(-1)!;
  const previous = candles.at(-2)!;
  const closes = candles.map((bar) => bar.close);
  const weekly = weeklyCandles(candles);
  const weekCloses = weekly.map((bar) => bar.close);
  if (weekCloses.length < 24) return null;

  const dailyEma8 = ema(closes, 8)!;
  const dailyEma21 = ema(closes, 21)!;
  const weekEma8 = ema(weekCloses, 8)!;
  const weekEma21 = ema(weekCloses, 21)!;
  const priorWeekEma8 = ema(weekCloses.slice(0, -3), 8)!;
  const priorWeekEma21 = ema(weekCloses.slice(0, -3), 21)!;
  const avgVolume20 = averageVolume(candles.slice(0, -1), 20)!;
  const dollarVolume = latest.close * avgVolume20;
  const adrPct = adr(candles, 20)!;
  if (latest.close <= 3 || avgVolume20 < 250_000 || dollarVolume < 6_000_000 || adrPct < 1.2) return null;

  const stock5 = changePercent(closes, 5);
  const stock20 = changePercent(closes, 20);
  const stock63 = changePercent(closes, 63);
  const relative5Spy = stock5 - benchmarks.spy5;
  const relative5Qqq = stock5 - benchmarks.qqq5;
  const relative20Spy = stock20 - benchmarks.spy20;
  const relative20Qqq = stock20 - benchmarks.qqq20;
  const relative63Spy = stock63 - benchmarks.spy63;
  const relative63Qqq = stock63 - benchmarks.qqq63;
  const outperformingMarket =
    relative5Spy > 0 ||
    relative5Qqq > 0 ||
    relative20Spy > 0 ||
    relative20Qqq > 0 ||
    relative63Spy > 0 ||
    relative63Qqq > 0;

  const high20 = Math.max(...candles.slice(-20).map((bar) => bar.high));
  const high50 = Math.max(...candles.slice(-50).map((bar) => bar.high));
  const high252 = Math.max(...candles.slice(-252).map((bar) => bar.high));
  const near20High = latest.close >= high20 * 0.94;
  const near50High = latest.close >= high50 * 0.9;
  const near52WeekHigh = latest.close >= high252 * 0.85;
  const priorUptrend = stock63 > 8 || changePercent(closes, 126) > 15;

  const marketLeadershipScore = clamp(
    Math.max(0, Math.min(2.5, relative5Spy * 0.8)) +
      Math.max(0, Math.min(2.5, relative5Qqq * 0.8)) +
      Math.max(0, Math.min(3, relative20Spy * 0.35)) +
      Math.max(0, Math.min(3, relative20Qqq * 0.35)) +
      Math.max(0, Math.min(3, relative63Spy * 0.18)) +
      Math.max(0, Math.min(3, relative63Qqq * 0.18)) +
      Number(near20High) * 1.5 +
      Number(near50High) * 1.25 +
      Number(near52WeekHigh) * 1.25 +
      Number(priorUptrend) * 4,
    0,
    25,
  );

  const canonicalTheme = classifyMarketTheme(ticker, company, industry);
  const priorityTheme = [
    "Artificial Intelligence",
    "Semiconductors",
    "Data Centers",
    "Nuclear",
    "Quantum Computing",
    "Robotics & Autonomy",
    "Crypto",
    "Defense & Space",
    "Biotechnology",
    "Software & Cloud",
  ].includes(canonicalTheme);
  const sectorLeading = sector.rank <= 6 && sector.score >= 55;
  const themeScore = clamp(
    Math.max(0, Math.min(3, sector.change1d * 1.5)) +
      Math.max(0, Math.min(4, sector.change5d * 0.8)) +
      Math.max(0, Math.min(4, sector.relative20d * 0.65 + 2)) +
      Number(sectorLeading) * 3 +
      Number(priorityTheme) * 2 +
      Math.min(peerStrengthCount, 4),
    0,
    20,
  );
  const strongTheme = themeScore >= 11 || (sectorLeading && priorityTheme);

  const week8Rising = weekEma8 > priorWeekEma8;
  const week21Rising = weekEma21 > priorWeekEma21;
  const aboveWeek8 = latest.close >= weekEma8;
  const aboveWeek21 = latest.close >= weekEma21;
  const weekStacked = weekEma8 > weekEma21;
  const distanceWeek8 = distancePercent(latest.close, weekEma8);
  const recentFive = candles.slice(-5);
  const priorTen = candles.slice(-15, -5);
  const touchedWeek8 = Math.min(...recentFive.map((bar) => bar.low)) <= weekEma8 * 1.025;
  const undercutWeek8 = Math.min(...recentFive.map((bar) => bar.low)) < weekEma8 * 0.99;
  const reclaimWeek8 = undercutWeek8 && aboveWeek8;
  const bounceWeek8 = touchedWeek8 && aboveWeek8 && latest.close > previous.close;
  const pullbackVolume = averageVolume(recentFive.slice(0, -1), Math.min(4, recentFive.length - 1)) ?? latest.volume;
  const priorRunVolume = averageVolume(priorTen, Math.min(10, priorTen.length)) ?? avgVolume20;
  const pullbackVolumeRatio = pullbackVolume / Math.max(priorRunVolume, 1);
  const bounceVolumeRatio = latest.volume / Math.max(pullbackVolume, 1);
  const latestRed = latest.close < latest.open;
  const heavySellingBelowWeek8 = latest.close < weekEma8 && latestRed && latest.volume > avgVolume20 * 1.3;
  const weeklyTrendHealthy = aboveWeek8 && aboveWeek21 && week8Rising && week21Rising && weekStacked;
  const weeklyTrendScore = clamp(
    Number(aboveWeek8) * 4 +
      Number(week8Rising) * 5 +
      Number(aboveWeek21) * 3 +
      Number(week21Rising) * 3 +
      Number(weekStacked) * 3 +
      Number(bounceWeek8) * 3 +
      Number(reclaimWeek8) * 2 +
      Number(pullbackVolumeRatio <= 0.85) * 2 -
      Number(heavySellingBelowWeek8) * 8,
    0,
    25,
  );

  const base10 = candles.slice(-11, -1);
  const base20 = candles.slice(-21, -1);
  const prior20High = Math.max(...base20.map((bar) => bar.high));
  const breakout = latest.close > prior20High && latest.close >= latest.open;
  const failedBreakout = latest.high > prior20High && latest.close < prior20High && closePosition(latest) < 0.45;
  const dailyReclaim = previous.close < dailyEma8 && latest.close > dailyEma8;
  const undercutDaily = Math.min(...candles.slice(-5).map((bar) => bar.low)) < Math.min(dailyEma21, previous.low) && latest.close > dailyEma21;
  const tightBase = rangePercent(base10, latest.close) <= adrPct * 3;
  const closeStrength = closePosition(latest);
  const strongGreen = latest.close > latest.open && latest.close > previous.close && closeStrength >= 0.6;
  const upperWick = (latest.high - Math.max(latest.open, latest.close)) / Math.max(latest.high - latest.low, 0.01);
  const clearSetup = breakout || bounceWeek8 || reclaimWeek8 || dailyReclaim || undercutDaily || tightBase;
  const extensionRisk = clamp(
    Math.max(0, distanceWeek8 - 12) * 3 +
      Math.max(0, distancePercent(latest.close, dailyEma8) / Math.max(adrPct, 0.1) - 1.2) * 24,
  );
  const dailySetupScore = clamp(
    Number(latest.close > dailyEma8) * 3 +
      Number(latest.close > dailyEma21) * 2 +
      Number(dailyReclaim) * 3 +
      Number(tightBase) * 3 +
      Number(breakout) * 4 +
      Number(undercutDaily) * 3 +
      Number(closeStrength >= 0.6) * 2 +
      Number(strongGreen) * 2 -
      Number(failedBreakout) * 6 -
      Number(upperWick > 0.42) * 3 -
      Number(extensionRisk >= 50) * 8,
    0,
    20,
  );

  const relativeVolume = latest.volume / Math.max(avgVolume20, 1);
  const liquid = dollarVolume >= 20_000_000;
  const veryLiquid = dollarVolume >= 75_000_000;
  const tradabilityScore = clamp(
    Number(relativeVolume >= 1.3 && latest.close >= latest.open) * 2 +
      Number(pullbackVolumeRatio <= 0.85) * 2 +
      Number(liquid) * 2 +
      Number(veryLiquid) +
      Number(adrPct >= 2.5) * 2 +
      (optionsTradabilityScore == null ? 0.5 : optionsTradabilityScore / 100 * 2) -
      Number(optionSpreadDollars != null && optionSpreadDollars > 1.5) * 2,
    0,
    10,
  );

  const extension = extensionLabel(extensionRisk);
  let setup: SetupType;
  if (extensionRisk >= 50) setup = "Extended / Wait";
  else if (breakout) setup = "Breakout";
  else if (reclaimWeek8) setup = "8-Week EMA Reclaim";
  else if (bounceWeek8) setup = "8-Week EMA Bounce";
  else if (undercutDaily) setup = "Undercut and Reclaim";
  else if (tightBase) setup = "Tight Base";
  else setup = "Leader Pullback";

  let setupLabel: SetupLabel;
  if (heavySellingBelowWeek8) setupLabel = "Broken Leader - Lost 8W EMA";
  else if (failedBreakout) setupLabel = "Failed Breakout / Rejection Candle";
  else if (extensionRisk >= 50) setupLabel = "Extended Leader - Wait for Pullback";
  else if (!outperformingMarket) setupLabel = "Setup Only - Not a Leader";
  else if (breakout && marketLeadershipScore >= 18) setupLabel = "Market Leader Breakout";
  else if (breakout && strongTheme) setupLabel = "Strong Theme Breakout";
  else if (reclaimWeek8) setupLabel = "8-Week EMA Reclaim";
  else if (bounceWeek8 && strongTheme) setupLabel = "Theme Leader Reset";
  else if (bounceWeek8) setupLabel = "8-Week EMA Bounce";
  else if (touchedWeek8) setupLabel = "Leader Pullback Near 8W EMA";
  else setupLabel = "Low Quality Momentum";

  let scoreCap = 100;
  const capReasons: string[] = [];
  const applyCap = (cap: number, reason: string) => {
    if (cap < scoreCap) scoreCap = cap;
    capReasons.push(reason);
  };
  if (!outperformingMarket) applyCap(65, "Underperforming both SPY and QQQ");
  if (!strongTheme) applyCap(70, "Weak or non-leading theme");
  if (!aboveWeek21) applyCap(60, "Price below the 21-week EMA");
  if (!week8Rising) applyCap(60, "8-week EMA is declining");
  if (heavySellingBelowWeek8) applyCap(55, "Closed below the 8-week EMA on heavy selling");
  if (closeStrength < 0.5) applyCap(70, "Daily close finished below the candle midpoint");
  if (!clearSetup) applyCap(72, "No clear daily or weekly setup");
  if (!liquid || dollarVolume < 10_000_000) applyCap(68, "Poor liquidity");

  const finalScore = Math.min(
    scoreCap,
    marketLeadershipScore +
      themeScore +
      weeklyTrendScore +
      dailySetupScore +
      tradabilityScore,
  );
  const support = Math.max(
    Math.min(...recentFive.map((bar) => bar.low)),
    Math.min(weekEma8, dailyEma21),
  );
  const baseLow = Math.min(...base10.map((bar) => bar.low));
  const earlierRange = rangePercent(candles.slice(-20, -10), latest.close);
  const recentRange = rangePercent(base10, latest.close);
  const tighteningPercent = clamp((1 - recentRange / Math.max(earlierRange, 0.01)) * 100);

  return {
    setup,
    setupLabel,
    canonicalTheme,
    marketLeadershipScore,
    themeScore,
    weeklyTrendScore,
    dailySetupScore,
    tradabilityScore,
    finalScore,
    scoreCap,
    capReasons: [...new Set(capReasons)],
    relative5Spy,
    relative5Qqq,
    relative20Spy,
    relative20Qqq,
    relative63Spy,
    relative63Qqq,
    weekEma8,
    weekEma21,
    distanceWeek8,
    weeklyTrendHealthy,
    outperformingMarket,
    strongTheme,
    peerStrengthCount,
    extensionRisk,
    extension,
    setupQuality: dailySetupScore / 20 * 100,
    dailyClosePosition: closeStrength,
    breakoutLevel: Math.max(prior20High, latest.high),
    support,
    baseLow,
    baseDays: 10,
    tighteningPercent,
    pullbackVolumeRatio,
    bounceVolumeRatio,
    heavySellingBelowWeek8,
    reasons: [
      `Relative performance vs SPY/QQQ: ${relative5Spy.toFixed(1)}%/${relative5Qqq.toFixed(1)}% over 5D, ${relative20Spy.toFixed(1)}%/${relative20Qqq.toFixed(1)}% over 20D, and ${relative63Spy.toFixed(1)}%/${relative63Qqq.toFixed(1)}% over 3M`,
      `${canonicalTheme} theme score is ${themeScore.toFixed(1)}/20 with ${peerStrengthCount} strong peer${peerStrengthCount === 1 ? "" : "s"}`,
      `Weekly structure scores ${weeklyTrendScore.toFixed(1)}/25; price is ${distanceWeek8.toFixed(1)}% from the ${week8Rising ? "rising" : "declining"} 8-week EMA`,
      `${setupLabel}; daily setup quality is ${dailySetupScore.toFixed(1)}/20`,
      `Dollar volume is $${(dollarVolume / 1_000_000).toFixed(1)}M with ${relativeVolume.toFixed(2)}x relative volume`,
    ],
  };
}
