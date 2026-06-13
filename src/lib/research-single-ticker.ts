import { getOptionsConfluence } from "@/lib/data/market-confluence-provider";
import { ProviderRouter } from "@/lib/data/provider-router";
import { getNasdaqUniverse } from "@/lib/data/providers/nasdaq-universe-provider";
import {
  getSectorMetadataMap,
  getSectorTheme,
} from "@/lib/data/sector-theme-map";
import { setCached, withCache } from "@/lib/data/cache";
import { changePercent } from "@/lib/scan/indicators";
import {
  analyzeSymbol,
  applyOptionsScoring,
} from "@/lib/scan/run-free-daily-scan";
import { clamp } from "@/lib/scoring";
import type { BenchmarkReturns, SectorContext } from "@/lib/scan/leader-scoring";
import type {
  DailyCandle,
  StockSetup,
  TickerResearchResult,
  UniverseSymbol,
} from "@/types/domain";

async function getReliableDaily(
  router: ProviderRouter,
  ticker: string,
  primaryLimit: number,
  fallbackLimit = 250,
): Promise<{ candles: DailyCandle[] | null; provider: string }> {
  const primary = await router.getDaily(ticker, primaryLimit);
  if (primary.candles?.length) return primary;
  const fallback = await router.getDaily(ticker, fallbackLimit);
  return {
    candles: fallback.candles,
    provider: fallback.candles ? `${fallback.provider}-fallback` : primary.provider,
  };
}

export async function researchSingleTicker(
  rawTicker: string,
): Promise<TickerResearchResult> {
  const ticker = rawTicker.trim().toUpperCase().replaceAll("-", ".");
  if (!/^[A-Z]{1,5}(?:[.-][A-Z])?$/.test(ticker)) {
    throw new Error("Enter a valid US stock ticker.");
  }

  const router = new ProviderRouter({
    enableYahooFallback: true,
    dailyCacheHours: 1,
  });
  const universeResult = await withCache(
    "universe:nasdaqtrader",
    24 * 60 * 60 * 1000,
    getNasdaqUniverse,
  );
  const symbol = universeResult.value.find((item) => item.symbol === ticker) ?? {
    symbol: ticker,
    name: ticker,
    exchange: "US",
    isETF: false,
    isTestIssue: false,
    source: "nasdaqtrader",
  } satisfies UniverseSymbol;

  const [stockResult, spyResult, qqqResult, sectorMetadata] = await Promise.all([
    getReliableDaily(router, ticker, 300),
    getReliableDaily(router, "SPY", 250, 300),
    getReliableDaily(router, "QQQ", 250, 300),
    getSectorMetadataMap(),
  ]);
  if (!stockResult.candles?.length) {
    throw new Error(`No completed daily price history was found for ${ticker}.`);
  }
  if (!spyResult.candles || !qqqResult.candles) {
    throw new Error("Market benchmark history is unavailable.");
  }

  const { sector, sectorTicker, theme } = getSectorTheme(
    ticker,
    symbol.name,
    sectorMetadata,
  );
  const sectorResult = await getReliableDaily(router, sectorTicker, 100, 250);
  const spyCloses = spyResult.candles.map((bar) => bar.close);
  const qqqCloses = qqqResult.candles.map((bar) => bar.close);
  const sectorStrength = sectorResult.candles
    ? clamp(
      50 +
      (
        changePercent(sectorResult.candles.map((bar) => bar.close), 63) -
        changePercent(spyCloses, 63)
      ) * 3.2,
    )
    : 50;
  const sectorCloses = sectorResult.candles?.map((bar) => bar.close) ?? [];
  const sectorContexts = new Map<string, SectorContext>([[
    sectorTicker,
    {
      score: sectorStrength,
      rank: sectorStrength >= 55 ? 6 : 9,
      change1d: changePercent(sectorCloses, 1),
      change5d: changePercent(sectorCloses, 5),
      change20d: changePercent(sectorCloses, 20),
      relative20d: changePercent(sectorCloses, 20) - changePercent(spyCloses, 20),
    },
  ]]);
  const benchmarks: BenchmarkReturns = {
    spy5: changePercent(spyCloses, 5),
    spy20: changePercent(spyCloses, 20),
    spy63: changePercent(spyCloses, 63),
    qqq5: changePercent(qqqCloses, 5),
    qqq20: changePercent(qqqCloses, 20),
    qqq63: changePercent(qqqCloses, 63),
  };
  const setup = analyzeSymbol(
    symbol,
    stockResult.candles,
    benchmarks,
    sectorMetadata,
    sectorContexts,
  );
  const latest = stockResult.candles.at(-1)!;
  const closes = stockResult.candles.map((bar) => bar.close);
  const options = await getOptionsConfluence(
    ticker,
    setup?.plan.entryHigh ?? latest.close,
  );

  let rankedSetup: StockSetup | null = null;
  if (setup) {
    rankedSetup = applyOptionsScoring(setup, options);
    rankedSetup.rank = 1;
    await setCached(
      `research:setup:${ticker}`,
      {
        setup: rankedSetup,
        marketDate: latest.date,
        scanTimestamp: new Date().toISOString(),
      },
      24 * 60 * 60 * 1000,
    );
  }

  return {
    ticker,
    company: symbol.name,
    researchedAt: new Date().toISOString(),
    marketDate: latest.date,
    dataMode: "completed-daily",
    provider: stockResult.provider,
    price: Number(latest.close.toFixed(2)),
    change: Number(changePercent(closes, 1).toFixed(2)),
    sector,
    sectorTicker,
    theme,
    sectorStrength: Math.round(sectorStrength),
    ...options,
    candles: stockResult.candles.slice(-260),
    setup: rankedSetup,
    summary: rankedSetup
      ? `${rankedSetup.setupLabel} detected and graded ${rankedSetup.grade} with a score of ${rankedSetup.finalScore}.`
      : "No liquid leader-first breakout, weekly EMA reset, reclaim, pullback, or tight-base setup currently qualifies.",
  };
}
