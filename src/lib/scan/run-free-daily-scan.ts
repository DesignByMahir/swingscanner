import pLimit from "p-limit";
import type {
  DailyCandle,
  FreeScanResult,
  ScannerRules,
  SectorLeadership,
  StockSetup,
  UniverseSymbol,
  TradePlan,
} from "@/types/domain";
import { scannerRules } from "@/lib/scanner-config";
import { clamp, gradeScore } from "@/lib/scoring";
import { setCached, withCache } from "@/lib/data/cache";
import { ProviderRouter } from "@/lib/data/provider-router";
import { getNasdaqUniverse } from "@/lib/data/providers/nasdaq-universe-provider";
import {
  getSectorMetadataMap,
  getSectorTheme,
  LIQUID_SCAN_PRIORITY,
  SECTOR_ETFS,
  SECTOR_NAMES,
  type SectorMetadata,
} from "@/lib/data/sector-theme-map";
import {
  getOptionsConfluence,
  type OptionsConfluence,
} from "@/lib/data/market-confluence-provider";
import { averageVolume, changePercent, distancePercent, ema, rsi } from "./indicators";
import { passesOptionsGate } from "./options-first";
import {
  scoreLeaderEvidence,
  type BenchmarkReturns,
  type LeaderEvidence,
  type SectorContext,
} from "./leader-scoring";
import { selectSectorBalanced } from "./sector-balanced-selection";

export interface FreeScanOptions {
  rules?: Partial<ScannerRules>;
  force?: boolean;
}

interface CandidateHistory {
  symbol: UniverseSymbol;
  candles: DailyCandle[];
}

function buildTradePlan(price: number, evidence: LeaderEvidence, candles: DailyCandle[]) {
  const latest = candles.at(-1)!;
  const adrDollars = price * (candles.slice(-20).reduce(
    (sum, bar) => sum + (bar.high - bar.low) / Math.max(bar.close, 0.01),
    0,
  ) / Math.min(candles.length, 20));
  const breakout = evidence.breakoutLevel;
  const isBreakout = evidence.setup === "Breakout" || evidence.setup === "Tight Base";
  const isReclaim = evidence.setup === "8-Week EMA Reclaim" || evidence.setup === "Undercut and Reclaim";
  const entryLow = isBreakout ? breakout : Math.max(latest.high, evidence.weekEma8);
  const entryHigh = entryLow + adrDollars * 0.2;
  const baseDepth = Math.max(breakout - evidence.baseLow, adrDollars);
  const tactic: TradePlan["tactic"] = evidence.setup === "Extended / Wait"
    ? "Avoid"
    : isBreakout
      ? "Breakout"
      : isReclaim
        ? "Reclaim"
        : evidence.setup === "8-Week EMA Bounce"
          ? "Bounce"
          : "Pullback";
  const trigger = isBreakout
    ? `Clear the horizontal pivot at ${breakout.toFixed(2)} with a strong close and expanding volume`
    : isReclaim
      ? `Hold the 8-week EMA near ${evidence.weekEma8.toFixed(2)} and clear ${latest.high.toFixed(2)} to confirm the reclaim`
      : evidence.setup === "8-Week EMA Bounce"
        ? `Confirm the bounce from the rising 8-week EMA near ${evidence.weekEma8.toFixed(2)} by clearing ${latest.high.toFixed(2)}`
        : evidence.setup === "Extended / Wait"
          ? `Do not chase. Wait for a reset toward the rising 8-week EMA near ${evidence.weekEma8.toFixed(2)}`
          : `Hold support near ${evidence.support.toFixed(2)} and clear ${latest.high.toFixed(2)} for a next-day entry`;

  return {
    bias: `${evidence.setupLabel}; constructive while weekly support near ${evidence.weekEma8.toFixed(2)} holds`,
    tactic,
    breakoutLevel: Number(breakout.toFixed(2)),
    alternateTrigger: Number(latest.high.toFixed(2)),
    baseLow: Number(evidence.baseLow.toFixed(2)),
    baseDays: evidence.baseDays,
    tighteningPercent: Number(evidence.tighteningPercent.toFixed(1)),
    trendlineStartDate: candles.at(-10)?.date ?? latest.date,
    trendlineStartPrice: Number(breakout.toFixed(2)),
    trendlineEndDate: latest.date,
    trendlineEndPrice: Number(breakout.toFixed(2)),
    entryLow: Number(entryLow.toFixed(2)),
    entryHigh: Number(entryHigh.toFixed(2)),
    trigger,
    confirmation: "Confirm the level on a completed daily close with improving relative strength and constructive volume",
    stopRule: "After entry, use the trigger day's low or the nearby weekly support level as the stop reference",
    target1: Number((entryLow + baseDepth * 0.5).toFixed(2)),
    target2: Number((entryLow + baseDepth).toFixed(2)),
    timeframe: `${evidence.setup} within a ${evidence.weeklyTrendHealthy ? "healthy" : "mixed"} weekly trend`,
    avoid: evidence.setup === "Extended / Wait"
      ? `Wait for price to move closer to the 8-week EMA; it is currently ${evidence.distanceWeek8.toFixed(1)}% above it`
      : `Avoid an entry more than ${adrDollars.toFixed(2)} above the trigger`,
    invalidation: `A decisive close below weekly support near ${evidence.weekEma8.toFixed(2)} invalidates the long setup`,
  };
}

export function analyzeSymbol(
  symbol: UniverseSymbol,
  candles: DailyCandle[],
  benchmarks: BenchmarkReturns,
  sectorMetadata: Record<string, SectorMetadata>,
  sectorContexts: Map<string, SectorContext>,
  peerStrengthCount = 0,
  options?: OptionsConfluence,
): StockSetup | null {
  const { sector, sectorTicker, theme, themeSlug } = getSectorTheme(
    symbol.symbol,
    symbol.name,
    sectorMetadata,
  );
  const sectorContext = sectorContexts.get(sectorTicker) ?? {
    score: 50,
    rank: 99,
    change1d: 0,
    change5d: 0,
    change20d: 0,
    relative20d: 0,
  };
  const evidence = scoreLeaderEvidence({
    ticker: symbol.symbol,
    company: symbol.name,
    industry: theme,
    candles,
    benchmarks,
    sector: sectorContext,
    peerStrengthCount,
    optionsTradabilityScore: options?.optionsTradabilityScore,
    optionSpreadDollars: options?.optionSpreadDollars,
  });
  if (!evidence) return null;

  const closes = candles.map((bar) => bar.close);
  const latest = candles.at(-1)!;
  const ema8Value = ema(closes, 8)!;
  const ema21Value = ema(closes, 21)!;
  const ema50Value = ema(closes, 50)!;
  const avgVolume = averageVolume(candles.slice(0, -1), 20)!;
  const relativeVolume = latest.volume / Math.max(avgVolume, 1);
  const adrPct = candles.slice(-20).reduce(
    (sum, bar) => sum + ((bar.high - bar.low) / Math.max(bar.close, 0.01)) * 100,
    0,
  ) / Math.min(candles.length, 20);
  const distance8 = distancePercent(latest.close, ema8Value);
  const distance21 = distancePercent(latest.close, ema21Value);
  const distance50 = distancePercent(latest.close, ema50Value);
  const plan = buildTradePlan(latest.close, evidence, candles);
  const status = evidence.heavySellingBelowWeek8 || evidence.finalScore < 55
    ? "Rejected"
    : evidence.setup === "Extended / Wait"
      ? "Watch only"
      : evidence.finalScore >= 78
        ? "Actionable"
        : "Watch only";

  const setupMatches = [
    evidence.setup,
    evidence.tighteningPercent >= 20 && evidence.setup !== "Tight Base" ? "Tight Base" : null,
  ].filter((item): item is StockSetup["setup"] => item !== null);

  return {
    rank: 0,
    ticker: symbol.symbol,
    company: symbol.name,
    sector,
    sectorTicker,
    sectorRank: sectorContext.rank,
    theme,
    themeSlug,
    canonicalTheme: evidence.canonicalTheme,
    price: Number(latest.close.toFixed(2)),
    change: Number(changePercent(closes, 1).toFixed(2)),
    adr: Number(adrPct.toFixed(2)),
    avgVolume: Math.round(avgVolume),
    relativeVolume: Number(relativeVolume.toFixed(2)),
    marketCap: null,
    marketCapUnavailable: true,
    analystRating: null,
    analystScore: null,
    optionsAvailable: options?.optionsAvailable ?? false,
    optionExpiration: options?.optionExpiration ?? null,
    optionDte: options?.optionDte ?? null,
    optionIv: options?.optionIv ?? null,
    optionSpreadDollars: options?.optionSpreadDollars ?? null,
    optionSpreadPct: options?.optionSpreadPct ?? null,
    optionOpenInterest: options?.optionOpenInterest ?? null,
    optionVolume: options?.optionVolume ?? null,
    optionsTradabilityScore: options?.optionsTradabilityScore ?? null,
    rsi: Number((rsi(closes, 14) ?? 50).toFixed(1)),
    distance8: Number(distance8.toFixed(2)),
    distance21: Number(distance21.toFixed(2)),
    distance50: Number(distance50.toFixed(2)),
    rs: Math.round(evidence.marketLeadershipScore / 20 * 100),
    setupLabel: evidence.setupLabel,
    relative5Spy: Number(evidence.relative5Spy.toFixed(2)),
    relative5Qqq: Number(evidence.relative5Qqq.toFixed(2)),
    relative20Spy: Number(evidence.relative20Spy.toFixed(2)),
    relative20Qqq: Number(evidence.relative20Qqq.toFixed(2)),
    relative63Spy: Number(evidence.relative63Spy.toFixed(2)),
    relative63Qqq: Number(evidence.relative63Qqq.toFixed(2)),
    weekEma8: Number(evidence.weekEma8.toFixed(2)),
    weekEma21: Number(evidence.weekEma21.toFixed(2)),
    distanceWeek8: Number(evidence.distanceWeek8.toFixed(2)),
    weeklyTrendHealthy: evidence.weeklyTrendHealthy,
    themeScore: Number(evidence.themeScore.toFixed(1)),
    peerStrengthCount,
    scoreCap: evidence.scoreCap,
    capReasons: evidence.capReasons,
    setup: evidence.setup,
    matchedSetups: [...new Set(setupMatches)],
    setupQuality: Math.round(evidence.setupQuality),
    extensionRisk: Math.round(evidence.extensionRisk),
    extension: evidence.extension,
    finalScore: Math.round(evidence.finalScore),
    grade: gradeScore(evidence.finalScore),
    status,
    earningsDays: 999,
    tighteningPercent: plan.tighteningPercent,
    scoreParts: [
      { label: "Market leadership / RS", value: evidence.marketLeadershipScore / 20 * 100, weight: 20 },
      { label: "Economic / category leadership", value: evidence.economicLeadershipScore / 15 * 100, weight: 15 },
      { label: "Theme / sector strength", value: evidence.themeScore / 15 * 100, weight: 15 },
      { label: "Weekly trend / 8W EMA", value: evidence.weeklyTrendScore / 25 * 100, weight: 25 },
      { label: "Daily setup quality", value: evidence.dailySetupScore / 20 * 100, weight: 20 },
      { label: "Volume / tradability", value: evidence.tradabilityScore / 10 * 100, weight: 10 },
    ],
    reasons: evidence.reasons,
    warnings: [
      "Market capitalization and institutional ownership are unavailable from free EOD candle sources.",
      ...evidence.capReasons.map((reason) => `Score capped: ${reason}.`),
      ...(options?.optionsTradabilityScore == null ? ["Usable 21-60 DTE options data was unavailable."] : []),
    ],
    plan,
  };
}

export function applyOptionsScoring(stock: StockSetup, options: OptionsConfluence) {
  Object.assign(stock, options);
  if (options.optionsTradabilityScore == null) {
    if (!stock.warnings.includes("Usable 21-60 DTE options data was unavailable.")) {
      stock.warnings.push("Usable 21-60 DTE options data was unavailable.");
    }
    return stock;
  }
  const optionsContribution =
    options.optionsTradabilityScore / 100 * 2 -
    Math.max(0, (options.optionSpreadDollars ?? 0) - 1) * 0.8;
  const existingPart = stock.scoreParts.find((part) => part.label === "Volume / tradability");
  const previousContribution = 0.5;
  const adjustment = clamp(optionsContribution, -2, 2) - previousContribution;
  stock.finalScore = Math.round(Math.min(stock.scoreCap, clamp(stock.finalScore + adjustment)));
  stock.grade = gradeScore(stock.finalScore);
  stock.status = stock.setupLabel === "Broken Leader - Lost 8W EMA" || stock.finalScore < 55
    ? "Rejected"
    : stock.setup === "Extended / Wait"
      ? "Watch only"
      : stock.finalScore >= 78
        ? "Actionable"
        : "Watch only";
  if (existingPart) {
    existingPart.value = clamp(existingPart.value + adjustment * 10);
  }
  stock.reasons.push(
    `Near-the-money calls show ${options.optionIv?.toFixed(1)}% IV with a $${options.optionSpreadDollars?.toFixed(2)} median spread and ${options.optionsTradabilityScore}/100 tradability`,
  );
  return stock;
}

function selectUniverse(all: UniverseSymbol[], max: number) {
  const bySymbol = new Map(all.map((item) => [item.symbol, item]));
  const priority = LIQUID_SCAN_PRIORITY.flatMap((symbol) =>
    bySymbol.get(symbol) ? [bySymbol.get(symbol)!] : [],
  );
  const used = new Set(priority.map((item) => item.symbol));
  return [...priority, ...all.filter((item) => !used.has(item.symbol))].slice(0, max);
}

function passesBroadPrefilter(closes: number[]) {
  if (closes.length < 205) return false;
  const price = closes.at(-1)!;
  const ema40 = ema(closes, 40)!;
  const high50 = Math.max(...closes.slice(-50));
  const strongPriorRun = changePercent(closes, 63) >= 5;
  return (
    price > 3 &&
    (
      Math.abs(distancePercent(price, ema40)) <= 18 ||
      price >= high50 * 0.82 ||
      strongPriorRun
    )
  );
}

function leaderComparator(left: StockSetup, right: StockSetup) {
  const leftEligible = Number(
    (
      left.relative5Spy > 0 ||
      left.relative5Qqq > 0 ||
      left.relative20Spy > 0 ||
      left.relative20Qqq > 0 ||
      left.relative63Spy > 0 ||
      left.relative63Qqq > 0
    ) &&
      left.themeScore >= 9,
  );
  const rightEligible = Number(
    (
      right.relative5Spy > 0 ||
      right.relative5Qqq > 0 ||
      right.relative20Spy > 0 ||
      right.relative20Qqq > 0 ||
      right.relative63Spy > 0 ||
      right.relative63Qqq > 0
    ) &&
      right.themeScore >= 9,
  );
  const leftActionability = leftEligible + Number(left.status === "Actionable" && left.setup !== "Extended / Wait");
  const rightActionability = rightEligible + Number(right.status === "Actionable" && right.setup !== "Extended / Wait");
  return (
    rightActionability - leftActionability ||
    right.finalScore - left.finalScore ||
    right.rs - left.rs ||
    right.themeScore - left.themeScore ||
    Number(right.weeklyTrendHealthy) - Number(left.weeklyTrendHealthy)
  );
}

export async function runFreeDailyScan(options: FreeScanOptions = {}): Promise<FreeScanResult> {
  const started = Date.now();
  const rules = { ...scannerRules, ...options.rules };
  const router = new ProviderRouter(rules);
  const universeResult = await withCache(
    "universe:nasdaqtrader",
    24 * 60 * 60 * 1000,
    getNasdaqUniverse,
  );
  const universe = selectUniverse(universeResult.value, rules.maxUniverseSize);
  const [spy, qqq] = await Promise.all([
    router.getDaily("SPY", 300),
    router.getDaily("QQQ", 300),
  ]);
  if (!spy.candles || !qqq.candles) {
    throw new Error("SPY and QQQ daily candles are required for leadership scoring.");
  }
  const spyCloses = spy.candles.map((bar) => bar.close);
  const qqqCloses = qqq.candles.map((bar) => bar.close);
  const benchmarks: BenchmarkReturns = {
    spy5: changePercent(spyCloses, 5),
    spy20: changePercent(spyCloses, 20),
    spy63: changePercent(spyCloses, 63),
    qqq5: changePercent(qqqCloses, 5),
    qqq20: changePercent(qqqCloses, 20),
    qqq63: changePercent(qqqCloses, 63),
  };

  const sectorMetadata = await getSectorMetadataMap();
  const sectorSnapshots = await Promise.all(SECTOR_ETFS.map(async (ticker) => {
    const result = await router.getDaily(ticker, 300);
    if (!result.candles) return null;
    const closes = result.candles.map((bar) => bar.close);
    const change1d = changePercent(closes, 1);
    const change5d = changePercent(closes, 5);
    const change20d = changePercent(closes, 20);
    const change63d = changePercent(closes, 63);
    const relative20d = change20d - benchmarks.spy20;
    const relative63d = change63d - benchmarks.spy63;
    const above21Day = closes.at(-1)! > ema(closes, 21)!;
    const above50Day = closes.at(-1)! > ema(closes, 50)!;
    const score = clamp(
      50 +
      change1d * 2 +
      change5d * 2 +
      relative20d * 3 +
      relative63d +
      Number(above21Day) * 6 +
      Number(above50Day) * 4,
    );
    return {
      ticker,
      sector: SECTOR_NAMES[ticker],
      score: Math.round(score),
      change1d: Number(change1d.toFixed(2)),
      change5d: Number(change5d.toFixed(2)),
      change20d: Number(change20d.toFixed(2)),
      change63d: Number(change63d.toFixed(2)),
      relative20d: Number(relative20d.toFixed(2)),
      relative63d: Number(relative63d.toFixed(2)),
      above21Day,
      above50Day,
    };
  }));
  const sectorLeadership: SectorLeadership[] = sectorSnapshots
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => right.score - left.score)
    .map((sector, index) => ({
      ...sector,
      rank: index + 1,
      isLeading: index < 6,
    }));
  const sectorContexts = new Map<string, SectorContext>(
    sectorLeadership.map((sector) => [
      sector.ticker,
      {
        score: sector.score,
        rank: sector.rank,
        change1d: sector.change1d,
        change5d: sector.change5d,
        change20d: sector.change20d,
        relative20d: sector.relative20d,
      },
    ]),
  );

  const failures: Array<{ symbol: string; reason: string }> = [];
  const broadCandidates: UniverseSymbol[] = [];
  const batchLimit = pLimit(4);
  const batchSize = 20;
  const batches = Array.from(
    { length: Math.ceil(universe.length / batchSize) },
    (_, index) => universe.slice(index * batchSize, (index + 1) * batchSize),
  );
  await Promise.all(batches.map((batch) => batchLimit(async () => {
    const closesBySymbol = await router.getDailyCloseBatch(
      batch.map((symbol) => symbol.symbol),
      300,
    );
    for (const symbol of batch) {
      const closes = closesBySymbol.get(symbol.symbol)?.map((item) => item.close);
      if (!closes) {
        failures.push({ symbol: symbol.symbol, reason: "No valid broad-market close history" });
      } else if (passesBroadPrefilter(closes)) {
        broadCandidates.push(symbol);
      }
    }
  })));

  const histories: CandidateHistory[] = [];
  const detailLimit = pLimit(8);
  await Promise.all(broadCandidates.map((symbol) => detailLimit(async () => {
    try {
      const result = await router.getDaily(symbol.symbol, 300);
      if (!result.candles) {
        failures.push({ symbol: symbol.symbol, reason: "No valid detailed daily candle history" });
      } else {
        histories.push({ symbol, candles: result.candles });
      }
    } catch (error) {
      failures.push({
        symbol: symbol.symbol,
        reason: error instanceof Error ? error.message : "Unknown provider error",
      });
    }
  })));

  const initialCandidates = histories.flatMap(({ symbol, candles }) => {
    const analyzed = analyzeSymbol(
      symbol,
      candles,
      benchmarks,
      sectorMetadata,
      sectorContexts,
    );
    return analyzed ? [analyzed] : [];
  });
  const strongPeerCounts = new Map<string, number>();
  for (const stock of initialCandidates) {
    const strongPeer =
      stock.rs >= 65 &&
      stock.finalScore >= 60 &&
      (stock.relative20Qqq > 0 || stock.relative20Spy > 0);
    if (strongPeer) {
      strongPeerCounts.set(
        stock.canonicalTheme,
        (strongPeerCounts.get(stock.canonicalTheme) ?? 0) + 1,
      );
    }
  }

  const candidates = histories.flatMap(({ symbol, candles }) => {
    const metadata = getSectorTheme(symbol.symbol, symbol.name, sectorMetadata);
    const preliminary = initialCandidates.find((stock) => stock.ticker === symbol.symbol);
    const canonicalTheme = preliminary?.canonicalTheme ?? metadata.theme;
    const peerCount = Math.max(0, (strongPeerCounts.get(canonicalTheme) ?? 0) - 1);
    const analyzed = analyzeSymbol(
      symbol,
      candles,
      benchmarks,
      sectorMetadata,
      sectorContexts,
      peerCount,
    );
    return analyzed ? [analyzed] : [];
  });

  const rankedCandidates = [...candidates].sort(leaderComparator);
  const sectorOrder = sectorLeadership.map((sector) => sector.sector);
  const preliminary = selectSectorBalanced(rankedCandidates, sectorOrder, {
    limit: rules.maxOptionsCandidates,
    preserveTop: 25,
    reservePerSector: 10,
  });
  const optionsLimit = pLimit(4);
  await Promise.all(preliminary.map((stock) => optionsLimit(async () => {
    const optionsData = await getOptionsConfluence(stock.ticker, stock.plan.entryHigh);
    applyOptionsScoring(stock, optionsData);
  })));

  const rankedWithOptions = preliminary.sort(leaderComparator);
  const outputCandidates = rankedWithOptions.filter((stock) =>
    stock.finalScore >= 70 &&
    stock.status !== "Rejected" &&
    stock.setup !== "Extended / Wait" &&
    stock.extension !== "Avoid / Chasing" &&
    stock.tighteningPercent >= 10,
  );
  const sectorCap = Math.max(5, Math.ceil(rules.maxScannerResults * 0.18));
  const topSetups = selectSectorBalanced(outputCandidates, sectorOrder, {
    limit: rules.maxScannerResults,
    preserveTop: 5,
    reservePerSector: 3,
    maxPerSector: sectorCap,
  })
    .map((stock, index) => ({
      ...stock,
      rank: index + 1,
      grade: gradeScore(stock.finalScore),
    } satisfies StockSetup));

  const watchlist = topSetups
    .filter((stock) => stock.status !== "Rejected" && stock.setup !== "Extended / Wait")
    .slice(0, rules.maxWatchlistItems);
  const result: FreeScanResult = {
    mode: "free-eod",
    scanId: crypto.randomUUID(),
    scanTimestamp: new Date().toISOString(),
    marketDate: spy.candles.at(-1)!.date,
    durationMs: Date.now() - started,
    universeCount: universeResult.value.length,
    scannedCount: universe.length,
    passedBaseFilters: candidates.length,
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
      dailyPrimary: "yahoo-batch leadership prefilter",
      dailyFallback: "yahoo/stooq detail",
      cacheHits: router.cacheHits + Number(universeResult.hit),
      cacheMisses: router.cacheMisses + Number(!universeResult.hit),
      stooqRequests: router.stooq.requests,
      yahooRequests: router.yahoo.requests,
      failedSymbols: failures.length,
      warnings: [
        ...router.warnings,
        "Ranked by relative strength, economic and category leadership, durable theme strength, weekly 8-week EMA structure, daily setup quality, and tradability.",
        "Every setup must pass the tight-base gate: horizontal resistance, no repeated higher highs/lower lows, contraction, and drying volume near the 8/21 EMAs.",
        "If the market does not offer enough A-quality bases, the scanner now returns a smaller list instead of filling it with loose momentum.",
        "Peripheral ad-tech and low-conviction intermediary businesses are suppressed even when their charts temporarily outperform.",
        "Options quality contributes to tradability but does not blanket-exclude otherwise strong leaders.",
        "The final list preserves the strongest market leaders while reserving qualified setups across all represented sectors.",
      ],
    },
    sectorLeadership,
    topSetups,
    watchlist,
  };
  await setCached("scan:free-eod:latest", result, 48 * 60 * 60 * 1000);
  return result;
}
