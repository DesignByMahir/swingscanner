import YahooFinance from "yahoo-finance2";
import type {
  FreeScanResult,
  MarketEvent,
  MarketIntelligence,
  MarketNewsItem,
  SectorPerformance,
  StockSetup,
} from "@/types/domain";
import { changePercent, sma } from "@/lib/scan/indicators";
import { getCached, setCached } from "./cache";
import { ProviderRouter } from "./provider-router";
import { SECTOR_ETFS } from "./sector-theme-map";

const yahooFinance = new YahooFinance();
const CACHE_KEY = "market:intelligence:latest";
const CACHE_TTL_MS = 30 * 60 * 1000;
const HIGH_IMPACT_RELEASES = /consumer price index|employment situation|producer price index|personal income|gross domestic product|fomc|federal reserve/i;
const MARKET_MOVING_NEWS = /stock market|stocks|s&p|nasdaq|dow|federal reserve|fed\b|interest rate|inflation|cpi|jobs report|employment|gdp|treasury|bond yield|oil|energy|war|conflict|iran|israel|ukraine|sanction|shipping|tariff|recession|economy|economic/i;

const sectorNames: Record<(typeof SECTOR_ETFS)[number], string> = {
  XLB: "Materials",
  XLC: "Communication Services",
  XLE: "Energy",
  XLF: "Financials",
  XLI: "Industrials",
  XLK: "Technology",
  XLP: "Consumer Staples",
  XLRE: "Real Estate",
  XLU: "Utilities",
  XLV: "Healthcare",
  XLY: "Consumer Discretionary",
};

function round(value: number, decimals = 2) {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function sectorSignal(relative20d: number, above20Day: boolean, above50Day: boolean): SectorPerformance["signal"] {
  if (relative20d > 1 && above20Day && above50Day) return "Leading";
  if (relative20d > 0 && above20Day) return "Improving";
  if (relative20d < -1 && !above20Day && !above50Day) return "Lagging";
  return "Mixed";
}

function setupContext(setups: StockSetup[], watchlist: StockSetup[], sectorTicker: string) {
  const matching = setups.filter((setup) => setup.sectorTicker === sectorTicker);
  const watchlistMatching = watchlist.filter((setup) => setup.sectorTicker === sectorTicker);
  const actionable = matching.filter((setup) => setup.status === "Actionable");
  return {
    scannerCount: matching.length,
    watchlistCount: watchlistMatching.length,
    actionableCount: actionable.length,
    averageSetupScore: matching.length
      ? round(matching.reduce((sum, setup) => sum + setup.finalScore, 0) / matching.length, 1)
      : null,
  };
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function loadNews(queries: Array<{ query: string; scope: MarketNewsItem["scope"]; context: string }>) {
  const batches = await mapConcurrent(queries, 3, async ({ query, scope, context }) => {
    try {
      const result = await yahooFinance.search(query, {
        quotesCount: 0,
        newsCount: scope === "watchlist" ? 4 : 3,
        region: "US",
        lang: "en-US",
      });
      return result.news.flatMap<MarketNewsItem>((article) => {
        if (!article.link.startsWith("http://") && !article.link.startsWith("https://")) return [];
        if ((context === "Global macro" || context === "Geopolitical risk") && !MARKET_MOVING_NEWS.test(article.title)) return [];
        return [{
          id: article.uuid || `${article.link}:${article.title}`,
          title: article.title,
          publisher: article.publisher,
          url: article.link,
          publishedAt: article.providerPublishTime.toISOString(),
          relatedTickers: article.relatedTickers ?? [],
          scope,
          context,
        }];
      });
    } catch {
      return [];
    }
  });

  const unique = new Map<string, MarketNewsItem>();
  for (const item of batches.flat()) {
    const key = item.url.split("?")[0].toLowerCase();
    const existing = unique.get(key);
    if (!existing || (existing.scope === "sector" && item.scope === "watchlist")) unique.set(key, item);
  }
  return [...unique.values()]
    .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
    .slice(0, 60);
}

function trendDescription(closes: number[]) {
  const price = closes.at(-1);
  const average20 = sma(closes, 20);
  const average50 = sma(closes, 50);
  if (price == null || average20 == null || average50 == null) return "unavailable";
  if (price > average20 && average20 > average50) return "above rising 20-day and 50-day averages";
  if (price < average20 && average20 < average50) return "below falling 20-day and 50-day averages";
  return "between or crossing key moving averages";
}

async function loadUpcomingEvents(): Promise<MarketEvent[]> {
  try {
    const response = await fetch("https://www.bls.gov/schedule/news_release/bls.ics", {
      headers: { "user-agent": "SwingScanner/1.0 local research app" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const blocks = (await response.text()).split("BEGIN:VEVENT").slice(1);
    const now = Date.now();
    return blocks.flatMap<MarketEvent>((block, index) => {
      const title = block.match(/SUMMARY:(.+)/)?.[1]?.trim();
      const rawDate = block.match(/DTSTART(?:;[^:]*)?:(\d{8}T?\d{0,6})/)?.[1];
      if (!title || !rawDate || !HIGH_IMPACT_RELEASES.test(title)) return [];
      const startsAt = rawDate.includes("T")
        ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}T${rawDate.slice(9, 11)}:${rawDate.slice(11, 13)}:00-04:00`
        : `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}T08:30:00-04:00`;
      const timestamp = Date.parse(startsAt);
      if (!Number.isFinite(timestamp) || timestamp < now || timestamp > now + 21 * 86_400_000) return [];
      return [{ id: `bls-${index}-${rawDate}`, title, startsAt, impact: "High", source: "U.S. Bureau of Labor Statistics" }];
    }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, 6);
  } catch {
    return [];
  }
}

async function buildMarketIntelligence(): Promise<MarketIntelligence> {
  const warnings: string[] = [];
  const latestScan = await getCached<FreeScanResult>("scan:free-eod:latest", true);
  const scan = latestScan?.value ?? null;
  const setups = scan?.topSetups ?? [];
  const watchlist = scan?.watchlist ?? [];
  const watchlistTickers = [...new Set(watchlist.map((setup) => setup.ticker))];
  const router = new ProviderRouter({ enableYahooFallback: true, dailyCacheHours: 20 });

  const [spyResult, qqqResult, vixResult, sectorResults, upcomingEvents] = await Promise.all([
    router.getDaily("SPY", 130),
    router.getDaily("QQQ", 130),
    router.getDaily("^VIX", 130),
    Promise.all(SECTOR_ETFS.map(async (ticker) => ({
      ticker,
      result: await router.getDaily(ticker, 130),
    }))),
    loadUpcomingEvents(),
  ]);

  const spyCloses = spyResult.candles?.map((candle) => candle.close) ?? [];
  const qqqCloses = qqqResult.candles?.map((candle) => candle.close) ?? [];
  const vixCloses = vixResult.candles?.map((candle) => candle.close) ?? [];
  const spy20d = changePercent(spyCloses, 20);
  const sectors: SectorPerformance[] = [];

  for (const { ticker, result } of sectorResults) {
    const candles = result.candles;
    if (!candles?.length) {
      warnings.push(`${ticker} performance is temporarily unavailable.`);
      continue;
    }
    const closes = candles.map((candle) => candle.close);
    const price = closes.at(-1)!;
    const average20 = sma(closes, 20);
    const average50 = sma(closes, 50);
    const change20d = changePercent(closes, 20);
    const relative20d = change20d - spy20d;
    const above20Day = average20 !== null && price > average20;
    const above50Day = average50 !== null && price > average50;
    sectors.push({
      rank: 0,
      ticker,
      sector: sectorNames[ticker],
      price: round(price),
      change1d: round(changePercent(closes, 1)),
      change5d: round(changePercent(closes, 5)),
      change20d: round(change20d),
      change63d: round(changePercent(closes, 63)),
      relative20d: round(relative20d),
      above20Day,
      above50Day,
      signal: sectorSignal(relative20d, above20Day, above50Day),
      sparkline: closes.slice(-30).map((value) => round(value)),
      ...setupContext(setups, watchlist, ticker),
    });
  }

  sectors.sort((left, right) => right.change20d - left.change20d);
  sectors.forEach((sector, index) => {
    sector.rank = index + 1;
  });
  const leadingSectors = sectors.filter((sector) => sector.signal === "Leading").slice(0, 3).map((sector) => sector.sector);
  const positiveSectors = sectors.filter((sector) => sector.change20d > 0).length;
  const spyTrend = trendDescription(spyCloses);
  const qqqTrend = trendDescription(qqqCloses);
  const vix = vixCloses.at(-1);
  const bullishIndexes = Number(spyTrend.startsWith("above")) + Number(qqqTrend.startsWith("above"));
  const bearishIndexes = Number(spyTrend.startsWith("below")) + Number(qqqTrend.startsWith("below"));
  const bias = bullishIndexes === 2 && positiveSectors >= 7
    ? "Bullish"
    : bearishIndexes === 2 && positiveSectors <= 4
      ? "Bearish"
      : bullishIndexes === 0 && bearishIndexes === 0
        ? "Choppy"
        : "Mixed";
  const riskContext = vix == null
    ? "Volatility data is unavailable."
    : vix >= 25
      ? `Risk is elevated with VIX near ${vix.toFixed(1)}.`
      : vix >= 18
        ? `Volatility is moderate with VIX near ${vix.toFixed(1)}.`
        : `Volatility is contained with VIX near ${vix.toFixed(1)}.`;
  const summary = bias === "Bullish"
    ? "Indexes and sector participation are constructive. Favor clean horizontal breakouts and orderly 8/21 EMA bases without chasing."
    : bias === "Bearish"
      ? "Indexes are below key averages with weak participation. Be selective and avoid forcing long breakouts."
      : bias === "Choppy"
        ? "Indexes are crossing key averages without clear participation. Favor patience, cleaner pullbacks, and confirmed closes."
        : "Index trends are split or sector participation is uneven. Keep size and setup count selective.";

  const queries = [
    { query: "stock market economy Federal Reserve inflation geopolitics", scope: "sector" as const, context: "Global macro" },
    { query: "war conflict oil markets shipping sanctions", scope: "sector" as const, context: "Geopolitical risk" },
    ...watchlistTickers.map((ticker) => ({ query: ticker, scope: "watchlist" as const, context: ticker })),
    ...sectors.map((sector) => ({ query: sector.ticker, scope: "sector" as const, context: sector.sector })),
  ];
  const news = await loadNews(queries);
  if (!news.length) warnings.push("The free Yahoo Finance news feed is temporarily unavailable.");

  return {
    generatedAt: new Date().toISOString(),
    marketDate: scan?.marketDate ?? sectorResults.find(({ result }) => result.candles?.length)?.result.candles?.at(-1)?.date ?? null,
    source: "Yahoo Finance public market data and news search",
    watchlistTickers,
    sectors,
    news,
    marketState: { bias, summary, spyTrend, qqqTrend, riskContext, leadingSectors },
    upcomingEvents,
    warnings,
  };
}

export async function getMarketIntelligence(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = await getCached<MarketIntelligence>(CACHE_KEY);
    if (cached) return { value: cached.value, cacheHit: true };
  }

  try {
    const value = await buildMarketIntelligence();
    await setCached(CACHE_KEY, value, CACHE_TTL_MS);
    return { value, cacheHit: false };
  } catch (error) {
    const stale = await getCached<MarketIntelligence>(CACHE_KEY, true);
    if (stale) {
      return {
        value: {
          ...stale.value,
          warnings: [...stale.value.warnings, "Live refresh failed; showing the most recent cached sector and news data."],
        },
        cacheHit: true,
      };
    }
    throw error;
  }
}
