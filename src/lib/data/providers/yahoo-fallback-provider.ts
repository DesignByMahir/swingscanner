import type { DailyCandle } from "@/types/domain";

type YahooResult = {
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: Array<number | null>;
      high?: Array<number | null>;
      low?: Array<number | null>;
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
};

type YahooChart = { chart?: { result?: YahooResult[] } };

type YahooSpark = {
  spark?: {
    result?: Array<{
      symbol?: string;
      response?: YahooResult[];
    }>;
  };
};

export interface YahooClose {
  date: string;
  close: number;
}

function parseYahooResult(result: YahooResult, limit: number) {
  const quote = result?.indicators?.quote?.[0];
  if (!result?.timestamp || !quote) return null;
  const candles = result.timestamp.flatMap((timestamp, index) => {
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    const volume = quote.volume?.[index];
    if ([open, high, low, close, volume].some((value) => value == null || !Number.isFinite(value))) return [];
    return [{
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      open: open as number,
      high: high as number,
      low: low as number,
      close: close as number,
      volume: volume as number,
    }];
  });
  return candles.length >= 60 ? candles.slice(-limit) : null;
}

export class YahooFallbackProvider {
  requests = 0;

  async getDailyCandles(symbol: string, limit = 250): Promise<DailyCandle[] | null> {
    this.requests += 1;
    const yahooSymbol = symbol.replaceAll(".", "-");
    try {
      const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2y&events=history`, {
        headers: { "User-Agent": "Mozilla/5.0 SwingScanner/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) return null;
      const payload = await response.json() as YahooChart;
      const result = payload.chart?.result?.[0];
      return result ? parseYahooResult(result, limit) : null;
    } catch {
      return null;
    }
  }

  async getDailyClosesBatch(symbols: string[], limit = 250): Promise<Map<string, YahooClose[]>> {
    this.requests += 1;
    const yahooSymbols = symbols.map((symbol) => symbol.replaceAll(".", "-"));
    try {
      const response = await fetch(`https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(yahooSymbols.join(","))}&interval=1d&range=2y`, {
        headers: { "User-Agent": "Mozilla/5.0 SwingScanner/1.0", Accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) return new Map();
      const payload = await response.json() as YahooSpark;
      const closes = new Map<string, YahooClose[]>();
      for (const item of payload.spark?.result ?? []) {
        const result = item.response?.[0];
        if (!item.symbol || !result) continue;
        const quote = result.indicators?.quote?.[0];
        if (!result.timestamp || !quote?.close) continue;
        const parsed = result.timestamp.flatMap((timestamp, index) => {
          const close = quote.close?.[index];
          return close == null || !Number.isFinite(close)
            ? []
            : [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), close }];
        });
        if (parsed.length >= 60) closes.set(item.symbol.replaceAll("-", "."), parsed.slice(-limit));
      }
      return closes;
    } catch {
      return new Map();
    }
  }
}
