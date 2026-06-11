import type { DailyCandle } from "@/types/domain";
import { getCached, setCached } from "./cache";
import { StooqProvider } from "./providers/stooq-provider";
import { YahooFallbackProvider } from "./providers/yahoo-fallback-provider";
import type { YahooClose } from "./providers/yahoo-fallback-provider";

export interface RouterOptions {
  enableYahooFallback: boolean;
  dailyCacheHours: number;
}

export function completedDailyCandles(candles: DailyCandle[], now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  const marketDate = `${parts.year}-${parts.month}-${parts.day}`;
  const marketMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  return marketMinutes < 16 * 60 + 15
    ? candles.filter((candle) => candle.date !== marketDate)
    : candles;
}

export class ProviderRouter {
  readonly stooq = new StooqProvider();
  readonly yahoo = new YahooFallbackProvider();
  cacheHits = 0;
  cacheMisses = 0;
  warnings: string[] = [];

  constructor(private readonly options: RouterOptions) {}

  async getDaily(symbol: string, limit = 250): Promise<{ candles: DailyCandle[] | null; provider: string; cacheHit: boolean }> {
    const key = `daily:${symbol}:${limit}`;
    const cached = await getCached<DailyCandle[]>(key);
    if (cached) {
      this.cacheHits += 1;
      return { candles: completedDailyCandles(cached.value), provider: "cache", cacheHit: true };
    }
    this.cacheMisses += 1;
    let candles = this.options.enableYahooFallback ? await this.yahoo.getDailyCandles(symbol, limit) : null;
    let provider = "yahoo";
    if (!candles) {
      candles = await this.stooq.getDailyCandles(symbol, limit);
      provider = "stooq-fallback";
    }
    if (candles) await setCached(key, candles, this.options.dailyCacheHours * 60 * 60 * 1000);
    return { candles: candles ? completedDailyCandles(candles) : null, provider, cacheHit: false };
  }

  async getDailyCloseBatch(symbols: string[], limit = 250) {
    const fetched = await this.yahoo.getDailyClosesBatch(symbols, limit);
    const results = new Map<string, YahooClose[]>();
    for (const [symbol, closes] of fetched) {
      const completedDates = new Set(completedDailyCandles(closes.map((item) => ({
        date: item.date,
        open: item.close,
        high: item.close,
        low: item.close,
        close: item.close,
        volume: 0,
      }))).map((item) => item.date));
      results.set(symbol, closes.filter((item) => completedDates.has(item.date)));
    }
    return results;
  }
}
