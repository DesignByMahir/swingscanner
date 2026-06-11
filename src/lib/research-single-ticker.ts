import { getOptionsConfluence } from "@/lib/data/market-confluence-provider";
import { ProviderRouter } from "@/lib/data/provider-router";
import { getNasdaqUniverse } from "@/lib/data/providers/nasdaq-universe-provider";
import {
  getSectorMetadataMap,
  getSectorTheme,
} from "@/lib/data/sector-theme-map";
import { setCached, withCache } from "@/lib/data/cache";
import { changePercent, ema } from "@/lib/scan/indicators";
import {
  analyzeSymbol,
  applyOptionsScoring,
} from "@/lib/scan/run-free-daily-scan";
import { clamp } from "@/lib/scoring";
import type {
  StockSetup,
  TickerResearchResult,
  UniverseSymbol,
} from "@/types/domain";

function marketScore(
  spyCloses: number[],
  qqqCloses: number[],
) {
  const spyEma21 = ema(spyCloses, 21)!;
  const spyEma50 = ema(spyCloses, 50)!;
  const qqqEma21 = ema(qqqCloses, 21)!;
  const qqqEma50 = ema(qqqCloses, 50)!;
  return clamp(
    25 * Number(spyCloses.at(-1)! > spyEma21) +
    25 * Number(spyEma21 > spyEma50) +
    25 * Number(qqqCloses.at(-1)! > qqqEma21) +
    25 * Number(qqqEma21 > qqqEma50),
  );
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
    router.getDaily(ticker, 300),
    router.getDaily("SPY", 250),
    router.getDaily("QQQ", 250),
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
  const sectorResult = await router.getDaily(sectorTicker, 100);
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
  const sectorScores = new Map([[sectorTicker, sectorStrength]]);
  const setup = analyzeSymbol(
    symbol,
    stockResult.candles,
    changePercent(spyCloses, 63),
    marketScore(spyCloses, qqqCloses),
    sectorMetadata,
    sectorScores,
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
    setup: rankedSetup,
    summary: rankedSetup
      ? `${rankedSetup.setup} detected and graded ${rankedSetup.grade} with a score of ${rankedSetup.finalScore}.`
      : "No supported completed-daily breakout, flag, wedge, squeeze, consolidation, or EMA-base setup currently qualifies.",
  };
}
