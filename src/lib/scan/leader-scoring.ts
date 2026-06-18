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
  economicLeadershipScore: number;
  economicLeadershipLabel: string;
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

export interface EconomicLeadership {
  score: number;
  label: string;
  strategic: boolean;
  peripheral: boolean;
  reasons: string[];
}

export interface TightBaseEvidence {
  qualified: boolean;
  days: number;
  breakoutLevel: number;
  baseLow: number;
  rangePct: number;
  tighteningPercent: number;
  volumeDryUpRatio: number;
  resistanceTouches: number;
  higherHighCount: number;
  lowerLowCount: number;
  nearEmaStack: boolean;
}

const CATEGORY_LEADERS = new Set([
  "AAPL", "ABBV", "ALAB", "AMD", "AMAT", "AMZN", "ANET", "ASML", "AVGO", "BA",
  "BAC", "CAT", "CCJ", "CEG", "COP", "COST", "CRDO", "CRM", "CRWD", "CVX", "DELL", "ETN",
  "GE", "GILD", "GOOGL", "GS", "HD", "HOOD", "IONQ", "JPM", "KLAC", "KTOS",
  "LLY", "LMT", "LOW", "LRCX", "META", "MRVL", "MSFT", "MU", "NET", "NOC",
  "NOW", "NVDA", "ORCL", "PANW", "PLTR", "QCOM", "QBTS", "REGN", "RGTI",
  "RTX", "SLB", "SMCI", "SNOW", "TSM", "UBER", "UNH", "VRTX", "VRT", "VST",
  "WMT", "XOM",
]);

const PERIPHERAL_TICKERS = new Set(["TBLA"]);

export function assessEconomicLeadership(
  ticker: string,
  company: string,
  industry: string,
  canonicalTheme = classifyMarketTheme(ticker, company, industry),
): EconomicLeadership {
  const normalizedTicker = ticker.toUpperCase();
  const value = `${normalizedTicker} ${company} ${industry} ${canonicalTheme}`.toLowerCase();
  const categoryLeader = CATEGORY_LEADERS.has(normalizedTicker);
  const strategicInfrastructure =
    /semiconductor|chip|wafer|silicon|data center|server|networking|optical|fiber|power grid|electrification|cooling|nuclear|uranium|quantum|robot|automation|aerospace|defense|cyber|cloud infrastructure|foundry|industrial machinery|energy infrastructure/.test(value);
  const economyAnchor =
    /banking|payments|insurance|logistics|railroad|construction|healthcare|pharma|medical|energy|oil|gas|utility|consumer staples|grocery|retail infrastructure/.test(value);
  const durableInnovation =
    /artificial intelligence|machine learning|autonomous|genomic|biotechnology|electric vehicle|space technology/.test(value);
  const peripheral =
    PERIPHERAL_TICKERS.has(normalizedTicker) ||
    /adtech|advertising technology|content recommendation|traffic acquisition|click monetization|digital advertising intermediary/.test(value);

  const score = clamp(
    Number(categoryLeader) * 7 +
      Number(strategicInfrastructure) * 6 +
      Number(economyAnchor) * 4 +
      Number(durableInnovation) * 4 -
      Number(peripheral) * 12,
    0,
    15,
  );
  const strategic = categoryLeader || strategicInfrastructure || economyAnchor || durableInnovation;
  const label = peripheral
    ? "Peripheral / low-conviction business"
    : score >= 12
      ? "Global infrastructure leader"
      : score >= 8
        ? "Strategic theme leader"
        : score >= 4
          ? "Economy-linked operator"
          : "Performance-led only";

  return {
    score,
    label,
    strategic,
    peripheral,
    reasons: [
      ...(categoryLeader ? ["Recognized category leader with broad market relevance"] : []),
      ...(strategicInfrastructure ? ["Supports strategic technology, industrial, energy, or digital infrastructure"] : []),
      ...(economyAnchor ? ["Operates in a core economic sector or essential service"] : []),
      ...(durableInnovation ? ["Participates in a durable global innovation cycle"] : []),
      ...(peripheral ? ["Business model is peripheral to the strategic themes this scanner is designed to prioritize"] : []),
    ],
  };
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

function countRisingBreaks(values: number[], tolerance = 0.002) {
  return values.reduce((count, value, index) => {
    if (index === 0) return count;
    return value > values[index - 1] * (1 + tolerance) ? count + 1 : count;
  }, 0);
}

function countFallingBreaks(values: number[], tolerance = 0.002) {
  return values.reduce((count, value, index) => {
    if (index === 0) return count;
    return value < values[index - 1] * (1 - tolerance) ? count + 1 : count;
  }, 0);
}

export function analyzeTightBase(
  candles: DailyCandle[],
  dailyEma8: number,
  dailyEma21: number,
  adrPct: number,
): TightBaseEvidence {
  const latest = candles.at(-1)!;
  const price = candles.at(-2)?.close ?? latest.close;
  let best: TightBaseEvidence | null = null;

  for (let days = 4; days <= 15; days += 1) {
    const base = candles.slice(-(days + 1), -1);
    if (base.length !== days) continue;
    const highs = base.map((bar) => bar.high);
    const lows = base.map((bar) => bar.low);
    const closes = base.map((bar) => bar.close);
    const breakoutLevel = Math.max(...highs);
    const baseLow = Math.min(...lows);
    const rangePct = (breakoutLevel - baseLow) / Math.max(price, 0.01) * 100;
    const split = Math.max(2, Math.floor(days / 2));
    const first = base.slice(0, split);
    const second = base.slice(split);
    const firstRange = rangePercent(first, price);
    const secondRange = rangePercent(second.length ? second : first, price);
    const tighteningPercent = clamp((1 - secondRange / Math.max(firstRange, 0.01)) * 100);
    const firstVolume = averageVolume(first, first.length) ?? 1;
    const secondVolume = averageVolume(second.length ? second : first, second.length || first.length) ?? firstVolume;
    const volumeDryUpRatio = secondVolume / Math.max(firstVolume, 1);
    const higherHighCount = countRisingBreaks(highs);
    const lowerLowCount = countFallingBreaks(lows);
    const resistanceTouches = highs.filter((high) => high >= breakoutLevel * 0.975).length;
    const lastHigh = highs.at(-1)!;
    const firstHalfHigh = Math.max(...first.map((bar) => bar.high));
    const lastLow = lows.at(-1)!;
    const firstHalfLow = Math.min(...first.map((bar) => bar.low));
    const averageClose = closes.reduce((sum, close) => sum + close, 0) / closes.length;
    const nearEmaStack =
      Math.abs(distancePercent(averageClose, dailyEma8)) <= Math.max(adrPct * 2.2, 7) ||
      Math.abs(distancePercent(averageClose, dailyEma21)) <= Math.max(adrPct * 2.5, 8) ||
      baseLow <= Math.max(dailyEma8, dailyEma21) * 1.07;
    const tightRange = rangePct <= Math.min(Math.max(adrPct * 2.2, 5), 13);
    const tightening = secondRange <= firstRange * 0.9 || tighteningPercent >= 10;
    const volumeDrying = volumeDryUpRatio <= 1.02;
    const noHigherHighs =
      higherHighCount <= Math.max(2, Math.floor(days * 0.45)) &&
      lastHigh <= firstHalfHigh * 1.035;
    const noLowerLows =
      lowerLowCount <= Math.max(2, Math.floor(days * 0.45)) &&
      lastLow >= firstHalfLow * 0.94;
    const horizontalResistance = resistanceTouches >= 2;
    const notAlreadyGone = latest.close <= breakoutLevel * 1.08;
    const qualified =
      tightRange &&
      tightening &&
      volumeDrying &&
      noHigherHighs &&
      noLowerLows &&
      horizontalResistance &&
      nearEmaStack &&
      notAlreadyGone;
    const candidate = {
      qualified,
      days,
      breakoutLevel,
      baseLow,
      rangePct,
      tighteningPercent,
      volumeDryUpRatio,
      resistanceTouches,
      higherHighCount,
      lowerLowCount,
      nearEmaStack,
    };
    if (
      qualified &&
      (!best ||
        candidate.tighteningPercent + (1 - candidate.volumeDryUpRatio) * 100 > best.tighteningPercent + (1 - best.volumeDryUpRatio) * 100)
    ) {
      best = candidate;
    }
  }

  return best ?? {
    qualified: false,
    days: 0,
    breakoutLevel: 0,
    baseLow: 0,
    rangePct: 0,
    tighteningPercent: 0,
    volumeDryUpRatio: 1,
    resistanceTouches: 0,
    higherHighCount: 0,
    lowerLowCount: 0,
    nearEmaStack: false,
  };
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
      Number(priorUptrend) * 3,
    0,
    20,
  );

  const canonicalTheme = classifyMarketTheme(ticker, company, industry);
  const economicLeadership = assessEconomicLeadership(
    ticker,
    company,
    industry,
    canonicalTheme,
  );
  if (economicLeadership.peripheral) return null;
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
    15,
  );
  const strongTheme =
    themeScore >= 9 ||
    (sectorLeading && priorityTheme) ||
    economicLeadership.score >= 8;

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

  const base = analyzeTightBase(candles, dailyEma8, dailyEma21, adrPct);
  if (!base.qualified) return null;

  const breakout = latest.close > base.breakoutLevel && latest.close >= latest.open;
  const failedBreakout = latest.high > base.breakoutLevel && latest.close < base.breakoutLevel && closePosition(latest) < 0.45;
  const dailyReclaim = previous.close < dailyEma8 && latest.close > dailyEma8;
  const undercutDaily = Math.min(...candles.slice(-5).map((bar) => bar.low)) < Math.min(dailyEma21, previous.low) && latest.close > dailyEma21;
  const tightBase = base.qualified;
  const closeStrength = closePosition(latest);
  const strongGreen = latest.close > latest.open && latest.close > previous.close && closeStrength >= 0.6;
  const upperWick = (latest.high - Math.max(latest.open, latest.close)) / Math.max(latest.high - latest.low, 0.01);
  const nearPivot = latest.close >= base.breakoutLevel * 0.92 && latest.close <= base.breakoutLevel * 1.04;
  const clearSetup = tightBase && nearPivot && !failedBreakout;
  const extensionRisk = clamp(
    Math.max(0, distanceWeek8 - 12) * 3 +
      Math.max(0, distancePercent(latest.close, dailyEma8) / Math.max(adrPct, 0.1) - 1.2) * 24,
  );
  const dailySetupScore = clamp(
    Number(latest.close > dailyEma8) * 3 +
      Number(latest.close > dailyEma21) * 2 +
      Number(dailyReclaim || undercutDaily) * 1 +
      Number(tightBase) * 6 +
      Number(base.tighteningPercent >= 20) * 3 +
      Number(base.volumeDryUpRatio <= 0.85) * 3 +
      Number(nearPivot) * 2 +
      Number(breakout) * 4 +
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
  else if (tightBase) setup = "Tight Base";
  else setup = "Leader Pullback";

  let setupLabel: SetupLabel;
  if (heavySellingBelowWeek8) setupLabel = "Broken Leader - Lost 8W EMA";
  else if (failedBreakout) setupLabel = "Failed Breakout / Rejection Candle";
  else if (extensionRisk >= 50) setupLabel = "Extended Leader - Wait for Pullback";
  else if (!outperformingMarket) setupLabel = "Setup Only - Not a Leader";
  else if (breakout && marketLeadershipScore >= 18) setupLabel = "Market Leader Breakout";
  else if (breakout && strongTheme) setupLabel = "Strong Theme Breakout";
  else if (tightBase && strongTheme) setupLabel = "Theme Leader Reset";
  else setupLabel = "Low Quality Momentum";

  let scoreCap = 100;
  const capReasons: string[] = [];
  const applyCap = (cap: number, reason: string) => {
    if (cap < scoreCap) scoreCap = cap;
    capReasons.push(reason);
  };
  if (!outperformingMarket) applyCap(65, "Underperforming both SPY and QQQ");
  if (!strongTheme) applyCap(70, "Weak or non-leading theme");
  if (!economicLeadership.strategic) applyCap(68, "Performance-led stock without durable economic or thematic leadership");
  if (economicLeadership.score < 4) applyCap(62, "Low economic leadership relevance");
  if (!aboveWeek21) applyCap(60, "Price below the 21-week EMA");
  if (!week8Rising) applyCap(60, "8-week EMA is declining");
  if (heavySellingBelowWeek8) applyCap(55, "Closed below the 8-week EMA on heavy selling");
  if (closeStrength < 0.5) applyCap(70, "Daily close finished below the candle midpoint");
  if (!clearSetup) applyCap(72, "No clear daily or weekly setup");
  if (!nearPivot) applyCap(64, "Price is not near the tight base breakout pivot");
  if (!liquid || dollarVolume < 10_000_000) applyCap(68, "Poor liquidity");

  const finalScore = Math.min(
    scoreCap,
    marketLeadershipScore +
      economicLeadership.score +
      themeScore +
      weeklyTrendScore +
      dailySetupScore +
      tradabilityScore,
  );
  const support = Math.max(base.baseLow, Math.min(weekEma8, dailyEma21));

  return {
    setup,
    setupLabel,
    canonicalTheme,
    marketLeadershipScore,
    economicLeadershipScore: economicLeadership.score,
    economicLeadershipLabel: economicLeadership.label,
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
    breakoutLevel: base.breakoutLevel,
    support,
    baseLow: base.baseLow,
    baseDays: base.days,
    tighteningPercent: base.tighteningPercent,
    pullbackVolumeRatio,
    bounceVolumeRatio,
    heavySellingBelowWeek8,
    reasons: [
      `Relative performance vs SPY/QQQ: ${relative5Spy.toFixed(1)}%/${relative5Qqq.toFixed(1)}% over 5D, ${relative20Spy.toFixed(1)}%/${relative20Qqq.toFixed(1)}% over 20D, and ${relative63Spy.toFixed(1)}%/${relative63Qqq.toFixed(1)}% over 3M`,
      `${economicLeadership.label}: ${economicLeadership.score.toFixed(1)}/15 economic leadership points${economicLeadership.reasons.length ? ` (${economicLeadership.reasons.join("; ")})` : ""}`,
      `${canonicalTheme} theme score is ${themeScore.toFixed(1)}/15 with ${peerStrengthCount} strong peer${peerStrengthCount === 1 ? "" : "s"}`,
      `Weekly structure scores ${weeklyTrendScore.toFixed(1)}/25; price is ${distanceWeek8.toFixed(1)}% from the ${week8Rising ? "rising" : "declining"} 8-week EMA`,
      `${setupLabel}; ${base.days}-day tight base has ${base.tighteningPercent.toFixed(1)}% tightening, ${base.resistanceTouches} resistance touches, and ${base.volumeDryUpRatio.toFixed(2)}x late-base volume`,
      `Dollar volume is $${(dollarVolume / 1_000_000).toFixed(1)}M with ${relativeVolume.toFixed(2)}x relative volume`,
    ],
  };
}
