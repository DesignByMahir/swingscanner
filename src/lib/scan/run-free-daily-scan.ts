import pLimit from "p-limit";
import type { DailyCandle, FreeScanResult, ScannerRules, SetupType, StockSetup, UniverseSymbol } from "@/types/domain";
import { scannerRules } from "@/lib/scanner-config";
import { clamp, extensionLabel, gradeScore } from "@/lib/scoring";
import { setCached, withCache } from "@/lib/data/cache";
import { ProviderRouter } from "@/lib/data/provider-router";
import { getNasdaqUniverse } from "@/lib/data/providers/nasdaq-universe-provider";
import { getSectorMetadataMap, getSectorTheme, LIQUID_SCAN_PRIORITY, SECTOR_ETFS, type SectorMetadata } from "@/lib/data/sector-theme-map";
import {
  getOptionsConfluence,
  type OptionsConfluence,
} from "@/lib/data/market-confluence-provider";
import { adr, averageVolume, bollingerBandwidthPercentile, changePercent, distancePercent, ema, rsi } from "./indicators";
import { findBaseBuilder, passesOptionsGate } from "./options-first";
import { setupGeometry } from "./setup-geometry";

export interface FreeScanOptions {
  rules?: Partial<ScannerRules>;
  force?: boolean;
}

interface DetectedSetup {
  type: SetupType;
  quality: number;
  breakoutLevel: number;
  baseLow: number;
  support: number;
  baseDays: number;
  tighteningPercent: number;
  alternateTrigger: number;
  trendlineStartDate: string;
  trendlineStartPrice: number;
  trendlineEndDate: string;
  trendlineEndPrice: number;
  horizontalTouches: number;
  hasDescendingTrendline: boolean;
}

function detectSetups(candles: DailyCandle[], adrPct: number, ema8Value: number, ema21Value: number) {
  const latest = candles.at(-1)!;
  const closes = candles.map((bar) => bar.close);
  const base5 = candles.slice(-6, -1);
  const base8 = candles.slice(-9, -1);
  const base10 = candles.slice(-11, -1);
  const base20 = candles.slice(-21, -1);
  const previous20High = Math.max(...base20.map((bar) => bar.high));
  const rangePercent = (sample: DailyCandle[]) =>
    ((Math.max(...sample.map((bar) => bar.high)) - Math.min(...sample.map((bar) => bar.low))) / latest.close) * 100;
  const range5 = rangePercent(base5);
  const range8 = rangePercent(base8);
  const range10 = rangePercent(base10);
  const volume20 = averageVolume(candles.slice(0, -1), 20) ?? latest.volume;
  const baseVolume = averageVolume(base8, Math.min(5, base8.length)) ?? volume20;
  const matches: DetectedSetup[] = [];
  const dist8 = Math.abs(distancePercent(latest.close, ema8Value));
  const dist21 = Math.abs(distancePercent(latest.close, ema21Value));
  const squeeze = bollingerBandwidthPercentile(closes);
  const impulseStart = candles.at(-16)?.close ?? latest.close;
  const impulseEnd = candles.at(-6)?.close ?? latest.close;
  const impulsePercent = ((impulseEnd / impulseStart) - 1) * 100;
  const nearBreakout = latest.close >= previous20High * 0.97;
  const adrDollars = latest.close * adrPct / 100;
  const addMatch = (type: SetupType, quality: number, sample: DailyCandle[], support: number) => {
    matches.push({ type, quality, support, baseDays: sample.length, ...setupGeometry(sample, latest, adrDollars) });
  };
  const baseBuilder = findBaseBuilder(candles, adrPct, ema8Value, ema21Value);
  if (baseBuilder) {
    matches.push({
      type: "Base Builder",
      quality: baseBuilder.quality,
      support: baseBuilder.support,
      baseDays: baseBuilder.sample.length,
      ...setupGeometry(baseBuilder.sample, latest, adrDollars),
      tighteningPercent: baseBuilder.tighteningPercent,
    });
  }

  if (nearBreakout) {
    addMatch("Breakout Setup", 84 + clamp((latest.close / previous20High - 0.97) * 300, 0, 12), base20, Math.max(ema8Value, ema21Value));
  }
  if (impulsePercent >= Math.max(8, adrPct * 2) && range5 <= adrPct * 2.4 && latest.close >= ema8Value && baseVolume <= volume20 * 1.05) {
    addMatch("Bull Flag", 86 + clamp(impulsePercent - 8, 0, 10) - clamp(range5 / adrPct * 3, 0, 8), base5, ema8Value);
  }
  for (const days of [8, 10, 12, 15]) {
    const wedge = candles.slice(-days);
    const split = Math.floor(wedge.length / 2);
    const early = wedge.slice(0, split);
    const late = wedge.slice(split);
    const earlyHigh = Math.max(...early.map((bar) => bar.high));
    const lateHigh = Math.max(...late.map((bar) => bar.high));
    const earlyLow = Math.min(...early.map((bar) => bar.low));
    const lateLow = Math.min(...late.map((bar) => bar.low));
    const earlyRange = earlyHigh - earlyLow;
    const lateRange = lateHigh - lateLow;
    const converging =
      lateHigh <= earlyHigh * 1.012 &&
      lateLow >= earlyLow * 1.003 &&
      lateRange <= earlyRange * 0.86;
    const pressingTrigger = latest.close >= lateHigh - adrDollars * 0.55;
    if (converging && pressingTrigger && latest.close >= ema21Value * 0.98) {
      addMatch("Wedge Pop", 84 + clamp((1 - lateRange / Math.max(earlyRange, 0.01)) * 20, 0, 12), wedge, Math.max(earlyLow, ema21Value));
      break;
    }
  }
  if (range8 <= adrPct * 2.1) {
    addMatch("Tight Consolidation", 90 - clamp(range8 / adrPct * 5, 0, 12), base8, Math.max(ema8Value, ema21Value));
  }
  if (squeeze && squeeze.percentile <= 0.2) {
    addMatch("BB Squeeze", 96 - squeeze.percentile * 30, base10, Math.max(ema8Value, ema21Value));
  }
  if (dist8 <= adrPct * 0.6 && range8 <= adrPct * 3 && latest.close >= ema21Value) {
    addMatch("8 EMA Base", 89 - clamp(dist8 * 4, 0, 10) - clamp(range8 / adrPct * 2, 0, 6), base8, ema8Value);
  }
  if (dist21 <= adrPct * 0.7 && range10 <= adrPct * 3.4 && latest.close >= ema21Value * 0.995) {
    addMatch("21 EMA Base", 87 - clamp(dist21 * 3.5, 0, 10) - clamp(range10 / adrPct * 2, 0, 6), base10, ema21Value);
  }
  return matches.sort((a, b) => b.quality - a.quality);
}

function buildTradePlan(price: number, setup: DetectedSetup, adrPct: number) {
  const adrDollars = price * adrPct / 100;
  const breakout = setup.breakoutLevel;
  const entryLow = breakout;
  const entryHigh = breakout + adrDollars * 0.2;
  const baseDepth = Math.max(breakout - setup.baseLow, adrDollars);
  return {
    bias: `Constructive while the ${setup.baseDays}-day base holds above ${setup.support.toFixed(2)}`,
    tactic: "Breakout" as const,
    breakoutLevel: Number(breakout.toFixed(2)),
    alternateTrigger: Number(setup.alternateTrigger.toFixed(2)),
    baseLow: Number(setup.baseLow.toFixed(2)),
    baseDays: setup.baseDays,
    tighteningPercent: Number(setup.tighteningPercent.toFixed(1)),
    trendlineStartDate: setup.trendlineStartDate,
    trendlineStartPrice: Number(setup.trendlineStartPrice.toFixed(2)),
    trendlineEndDate: setup.trendlineEndDate,
    trendlineEndPrice: Number(setup.trendlineEndPrice.toFixed(2)),
    entryLow: Number(entryLow.toFixed(2)),
    entryHigh: Number(entryHigh.toFixed(2)),
    trigger: setup.hasDescendingTrendline
      ? `Optimal trigger: clear horizontal resistance at ${breakout.toFixed(2)}. Earlier trigger: clear the descending resistance trendline near ${setup.alternateTrigger.toFixed(2)}`
      : `Optimal trigger: clear the repeated horizontal resistance at ${breakout.toFixed(2)}. No valid descending trendline trigger is present`,
    confirmation: "Confirm price holds above the chosen trigger with expanding volume; use a live broker feed for execution",
    stopRule: "After entry, use the breakout day's low as the stop reference",
    target1: Number((breakout + baseDepth * 0.5).toFixed(2)),
    target2: Number((breakout + baseDepth).toFixed(2)),
    timeframe: `Daily ${setup.type.toLowerCase()} built over approximately ${setup.baseDays} sessions`,
    avoid: `Do not chase more than ${(adrDollars * 0.5).toFixed(2)} above the planned entry`,
    invalidation: `Before entry, a decisive loss of the ${setup.baseDays}-day base or support near ${setup.support.toFixed(2)} invalidates the setup`,
  };
}

export function analyzeSymbol(
  symbol: UniverseSymbol,
  candles: DailyCandle[],
  spyReturn63: number,
  marketScore: number,
  sectorMetadata: Record<string, SectorMetadata>,
  sectorScores: Map<string, number>,
): StockSetup | null {
  if (candles.length < 205) return null;
  const closes = candles.map((bar) => bar.close);
  const latest = candles.at(-1)!;
  const ema8Value = ema(closes, 8)!;
  const ema21Value = ema(closes, 21)!;
  const ema50Value = ema(closes, 50)!;
  const ema200Value = ema(closes, 200)!;
  const adrPct = adr(candles, 20)!;
  const avgVolume = averageVolume(candles.slice(0, -1), 20)!;
  const relativeVolume = latest.volume / Math.max(avgVolume, 1);
  const rsi14 = rsi(closes, 14)!;
  const dollarVolume = latest.close * avgVolume;
  if (latest.close <= 3 || avgVolume <= 350_000 || dollarVolume <= 8_000_000 || adrPct <= 2 || latest.close <= ema21Value * 0.97 || latest.close <= ema50Value * 0.98) return null;
  const matches = detectSetups(candles, adrPct, ema8Value, ema21Value);
  if (!matches.length) return null;
  const rsRaw = changePercent(closes, 63) - spyReturn63;
  const relativeStrength = clamp(50 + rsRaw * 3.2);
  const distance8 = distancePercent(latest.close, ema8Value);
  const distance21 = distancePercent(latest.close, ema21Value);
  const distance50 = distancePercent(latest.close, ema50Value);
  const extensionRisk = clamp(
    Math.max(0, distance8 / adrPct - 0.75) * 34 +
    Math.max(0, distance21 / adrPct - 1.25) * 20 +
    Math.max(0, rsi14 - 68) * 2,
  );
  const extension = extensionLabel(extensionRisk);
  const primary = matches[0];
  const { sector, sectorTicker, theme, themeSlug } = getSectorTheme(symbol.symbol, symbol.name, sectorMetadata);
  const sectorScore = sectorScores.get(sectorTicker) ?? 50;
  const trendScore = clamp(
    25 * Number(latest.close > ema8Value) +
    25 * Number(ema8Value > ema21Value) +
    25 * Number(ema21Value > ema50Value) +
    25 * Number(ema50Value > ema200Value),
  );
  const volumeQuality = clamp(55 + relativeVolume * 25);
  const locationQuality = clamp(100 - Math.abs(distance8 / adrPct) * 28);
  const structureQuality = clamp(
    58 +
    Math.min(primary.horizontalTouches, 4) * 9 +
    Number(primary.hasDescendingTrendline) * 4,
  );
  const setupQuality = clamp(primary.quality + Math.min(primary.horizontalTouches - 1, 3) * 2);
  const finalScore = clamp(
    marketScore * 0.14 +
    sectorScore * 0.24 +
    relativeStrength * 0.15 +
    volumeQuality * 0.11 +
    setupQuality * 0.14 +
    locationQuality * 0.08 +
    trendScore * 0.08 +
    structureQuality * 0.06 -
    extensionRisk * 0.18,
  );
  const plan = buildTradePlan(latest.close, primary, adrPct);
  const status = extension === "Avoid / Chasing" ? "Rejected" : finalScore >= 78 ? "Actionable" : "Watch only";
  const warnings = ["Market capitalization is unavailable from free EOD candle sources."];
  return {
    rank: 0,
    ticker: symbol.symbol,
    company: symbol.name,
    sector,
    sectorTicker,
    theme,
    themeSlug,
    price: Number(latest.close.toFixed(2)),
    change: Number(changePercent(closes, 1).toFixed(2)),
    adr: Number(adrPct.toFixed(2)),
    avgVolume: Math.round(avgVolume),
    relativeVolume: Number(relativeVolume.toFixed(2)),
    marketCap: null,
    marketCapUnavailable: true,
    analystRating: null,
    analystScore: null,
    optionsAvailable: false,
    optionExpiration: null,
    optionDte: null,
    optionIv: null,
    optionSpreadDollars: null,
    optionSpreadPct: null,
    optionOpenInterest: null,
    optionVolume: null,
    optionsTradabilityScore: null,
    rsi: Number(rsi14.toFixed(1)),
    distance8: Number(distance8.toFixed(2)),
    distance21: Number(distance21.toFixed(2)),
    distance50: Number(distance50.toFixed(2)),
    rs: Math.round(relativeStrength),
    setup: primary.type,
    matchedSetups: matches.map((match) => match.type),
    setupQuality: Math.round(setupQuality),
    extensionRisk: Math.round(extensionRisk),
    extension,
    finalScore: Math.round(finalScore),
    grade: gradeScore(finalScore),
    status,
    earningsDays: 999,
    tighteningPercent: plan.tighteningPercent,
    scoreParts: [
      { label: "Market regime", value: marketScore, weight: 14 },
      { label: "Sector strength", value: sectorScore, weight: 24 },
      { label: "Relative strength", value: relativeStrength, weight: 15 },
      { label: "Volume quality", value: volumeQuality, weight: 11 },
      { label: "Pattern quality", value: setupQuality, weight: 14 },
      { label: "EMA location", value: locationQuality, weight: 8 },
      { label: "Trend structure", value: trendScore, weight: 8 },
      { label: "Horizontal resistance", value: structureQuality, weight: 6 },
    ],
    reasons: [
      `${primary.type} detected with ${primary.horizontalTouches} touch${primary.horizontalTouches === 1 ? "" : "es"} near horizontal resistance at ${plan.breakoutLevel.toFixed(2)}`,
      primary.hasDescendingTrendline
        ? `A descending resistance trendline provides an earlier trigger near ${plan.alternateTrigger.toFixed(2)}`
        : "No valid descending resistance trendline was detected; the horizontal key level is the trigger",
      `${sector} sector (${sectorTicker}) strength score is ${Math.round(sectorScore)}; industry is ${theme}`,
      `Price is above the 21 EMA and 50 EMA`,
      `Average dollar volume is $${(dollarVolume / 1_000_000).toFixed(1)}M`,
      `Relative strength score is ${Math.round(relativeStrength)}`,
    ],
    warnings,
    plan,
  };
}

export function applyOptionsScoring(stock: StockSetup, options: OptionsConfluence) {
  Object.assign(stock, options);
  if (options.optionsTradabilityScore == null) {
    stock.warnings.push("Usable 21-60 DTE options data was unavailable.");
    return stock;
  }
  const optionsAdjustment =
    (options.optionsTradabilityScore - 60) * 0.22 -
    Math.max(0, (options.optionSpreadDollars ?? 0) - 1) * 5 -
    Math.max(0, 50 - (options.optionIv ?? 0)) * 0.08;
  stock.finalScore = Math.round(clamp(stock.finalScore + optionsAdjustment));
  stock.grade = gradeScore(stock.finalScore);
  stock.status = stock.extension === "Avoid / Chasing"
    ? "Rejected"
    : stock.finalScore >= 78
      ? "Actionable"
      : "Watch only";
  stock.scoreParts.push({
    label: "Options tradability",
    value: options.optionsTradabilityScore,
    weight: 18,
  });
  stock.reasons.push(
    `Near-the-money calls show ${options.optionIv?.toFixed(1)}% IV with a $${options.optionSpreadDollars?.toFixed(2)} median spread (${options.optionSpreadPct?.toFixed(1)}%)`,
  );
  return stock;
}

function selectUniverse(all: UniverseSymbol[], max: number) {
  const bySymbol = new Map(all.map((item) => [item.symbol, item]));
  const priority = LIQUID_SCAN_PRIORITY.flatMap((symbol) => bySymbol.get(symbol) ? [bySymbol.get(symbol)!] : []);
  const used = new Set(priority.map((item) => item.symbol));
  return [...priority, ...all.filter((item) => !used.has(item.symbol))].slice(0, max);
}

function passesBroadPrefilter(closes: number[]) {
  if (closes.length < 205) return false;
  const price = closes.at(-1)!;
  const ema8Value = ema(closes, 8)!;
  const ema21Value = ema(closes, 21)!;
  const ema50Value = ema(closes, 50)!;
  if (price <= 3 || price <= ema21Value * 0.96 || price <= ema50Value * 0.97) return false;
  const distance8 = Math.abs(distancePercent(price, ema8Value));
  const distance21 = Math.abs(distancePercent(price, ema21Value));
  const previous20High = Math.max(...closes.slice(-21, -1));
  const squeeze = bollingerBandwidthPercentile(closes);
  return (
    distance8 <= 10 ||
    distance21 <= 12 ||
    price >= previous20High * 0.92 ||
    Boolean(squeeze && squeeze.percentile <= 0.35)
  );
}

export async function runFreeDailyScan(options: FreeScanOptions = {}): Promise<FreeScanResult> {
  const started = Date.now();
  const rules = { ...scannerRules, ...options.rules };
  const router = new ProviderRouter(rules);
  const universeResult = await withCache("universe:nasdaqtrader", 24 * 60 * 60 * 1000, getNasdaqUniverse);
  const universe = selectUniverse(universeResult.value, rules.maxUniverseSize);
  const spy = await router.getDaily("SPY", 250);
  const qqq = await router.getDaily("QQQ", 250);
  if (!spy.candles || !qqq.candles) throw new Error("SPY and QQQ daily candles are required for the market filter.");
  const spyCloses = spy.candles.map((bar) => bar.close);
  const qqqCloses = qqq.candles.map((bar) => bar.close);
  const spyEma21 = ema(spyCloses, 21)!;
  const spyEma50 = ema(spyCloses, 50)!;
  const qqqEma21 = ema(qqqCloses, 21)!;
  const qqqEma50 = ema(qqqCloses, 50)!;
  const marketScore = clamp(
    25 * Number(spyCloses.at(-1)! > spyEma21) +
    25 * Number(spyEma21 > spyEma50) +
    25 * Number(qqqCloses.at(-1)! > qqqEma21) +
    25 * Number(qqqEma21 > qqqEma50),
  );
  const spyReturn63 = changePercent(spyCloses, 63);
  const sectorMetadata = await getSectorMetadataMap();
  const sectorScores = new Map<string, number>();
  await Promise.all(SECTOR_ETFS.map(async (ticker) => {
    const result = await router.getDaily(ticker, 100);
    if (!result.candles) return;
    const sectorReturn63 = changePercent(result.candles.map((bar) => bar.close), 63);
    sectorScores.set(ticker, clamp(50 + (sectorReturn63 - spyReturn63) * 3.2));
  }));
  const failures: Array<{ symbol: string; reason: string }> = [];
  const candidates: StockSetup[] = [];
  let passedBaseFilters = 0;
  const broadCandidates: UniverseSymbol[] = [];
  const batchLimit = pLimit(4);
  const batchSize = 20;
  const batches = Array.from({ length: Math.ceil(universe.length / batchSize) }, (_, index) =>
    universe.slice(index * batchSize, (index + 1) * batchSize),
  );
  await Promise.all(batches.map((batch) => batchLimit(async () => {
    const closesBySymbol = await router.getDailyCloseBatch(batch.map((symbol) => symbol.symbol), 250);
    for (const symbol of batch) {
      const closes = closesBySymbol.get(symbol.symbol)?.map((item) => item.close);
      if (!closes) {
        failures.push({ symbol: symbol.symbol, reason: "No valid broad-market close history" });
      } else if (passesBroadPrefilter(closes)) {
        broadCandidates.push(symbol);
      }
    }
  })));
  const detailLimit = pLimit(8);
  await Promise.all(broadCandidates.map((symbol) => detailLimit(async () => {
    try {
      const result = await router.getDaily(symbol.symbol, 250);
      if (!result.candles) {
        failures.push({ symbol: symbol.symbol, reason: "No valid detailed daily candle history" });
      } else {
        const candles = result.candles;
        const analyzed = analyzeSymbol(symbol, candles, spyReturn63, marketScore, sectorMetadata, sectorScores);
        if (analyzed) {
          passedBaseFilters += 1;
          candidates.push(analyzed);
        }
      }
    } catch (error) {
      failures.push({ symbol: symbol.symbol, reason: error instanceof Error ? error.message : "Unknown provider error" });
    }
  })));
  const preliminary = candidates
    .sort((a, b) => b.finalScore - a.finalScore || b.rs - a.rs)
    .slice(0, rules.maxOptionsCandidates);
  const optionsLimit = pLimit(4);
  await Promise.all(preliminary.map((stock) => optionsLimit(async () => {
    const options = await getOptionsConfluence(stock.ticker, stock.plan.entryHigh);
    applyOptionsScoring(stock, options);
  })));

  const topSetups = preliminary
    .sort((a, b) => b.finalScore - a.finalScore || b.rs - a.rs)
    .slice(0, rules.maxScannerResults)
    .map((stock, index) => ({
      ...stock,
      rank: index + 1,
      grade: gradeScore(stock.finalScore),
      status: stock.extension === "Avoid / Chasing" ? "Rejected" : stock.finalScore >= 78 ? "Actionable" : "Watch only",
    } satisfies StockSetup));
  const actionable = topSetups.filter((stock) => stock.status === "Actionable" && stock.extension !== "Avoid / Chasing");
  const watchlist = (actionable.length >= 3 ? actionable : topSetups.filter((stock) => stock.status !== "Rejected")).slice(0, rules.maxWatchlistItems);
  const result: FreeScanResult = {
    mode: "free-eod",
    scanId: crypto.randomUUID(),
    scanTimestamp: new Date().toISOString(),
    marketDate: spy.candles.at(-1)!.date,
    durationMs: Date.now() - started,
    universeCount: universeResult.value.length,
    scannedCount: universe.length,
    passedBaseFilters,
    optionsEligibleCount: topSetups.filter((stock) => passesOptionsGate(stock, rules)).length,
    optionsRejectedCount: topSetups.filter((stock) => !passesOptionsGate(stock, rules)).length,
    optionsGate: {
      minIv: rules.minOptionIv,
      maxSpreadDollars: rules.maxOptionSpreadDollars,
      maxSpreadPct: rules.maxOptionSpreadPct,
      minOpenInterest: rules.minOptionOpenInterest,
      minTradabilityScore: rules.minOptionsTradabilityScore,
    },
    failedCount: failures.length,
    failures: failures.slice(0, 100),
    providerStats: {
      universeProvider: "nasdaqtrader",
      dailyPrimary: "yahoo-batch prefilter",
      dailyFallback: "yahoo/stooq detail",
      cacheHits: router.cacheHits + Number(universeResult.hit),
      cacheMisses: router.cacheMisses + Number(!universeResult.hit),
      stooqRequests: router.stooq.requests,
      yahooRequests: router.yahoo.requests,
      failedSymbols: failures.length,
      warnings: [
        ...router.warnings,
        "Options quality is ranked rather than used as a blanket exclusion; only the strongest overall candidates are shown.",
      ],
    },
    topSetups,
    watchlist,
  };
  await setCached("scan:free-eod:latest", result, 48 * 60 * 60 * 1000);
  return result;
}
