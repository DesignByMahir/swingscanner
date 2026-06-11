import YahooFinance from "yahoo-finance2";
import { clamp } from "@/lib/scoring";

export interface AnalystConfluence {
  analystRating: string;
  analystScore: number;
}

export interface OptionsConfluence {
  optionsAvailable: boolean;
  optionExpiration: string | null;
  optionDte: number | null;
  optionIv: number | null;
  optionSpreadDollars: number | null;
  optionSpreadPct: number | null;
  optionOpenInterest: number | null;
  optionVolume: number | null;
  optionsTradabilityScore: number | null;
}

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

function parseAnalystRating(value?: string): AnalystConfluence | null {
  if (!value) return null;
  const match = value.match(/^([\d.]+)\s*-\s*(.+)$/);
  if (!match) return null;
  const mean = Number(match[1]);
  if (!Number.isFinite(mean)) return null;
  return { analystRating: match[2].trim(), analystScore: Math.round(clamp(125 - mean * 25)) };
}

export async function getAnalystConfluence(symbols: string[]) {
  const result = new Map<string, AnalystConfluence>();
  for (let index = 0; index < symbols.length; index += 50) {
    const batch = symbols.slice(index, index + 50).map((symbol) => symbol.replaceAll(".", "-"));
    try {
      const quotes = await yahooFinance.quote(batch);
      for (const quote of quotes) {
        const parsed = parseAnalystRating(quote.averageAnalystRating);
        if (quote.symbol && parsed) result.set(quote.symbol.replaceAll("-", "."), parsed);
      }
    } catch {
      // Optional confluence must never prevent a price-action scan.
    }
  }
  return result;
}

function daysBetween(date: Date, now: Date) {
  return Math.max(0, Math.round((date.getTime() - now.getTime()) / 86_400_000));
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export async function getOptionsConfluence(symbol: string, referencePrice: number): Promise<OptionsConfluence> {
  const unavailable: OptionsConfluence = {
    optionsAvailable: false,
    optionExpiration: null,
    optionDte: null,
    optionIv: null,
    optionSpreadDollars: null,
    optionSpreadPct: null,
    optionOpenInterest: null,
    optionVolume: null,
    optionsTradabilityScore: null,
  };
  try {
    const yahooSymbol = symbol.replaceAll(".", "-");
    const overview = await yahooFinance.options(yahooSymbol);
    const now = new Date();
    const expiration = overview.expirationDates
      .map((date) => ({ date, dte: daysBetween(date, now) }))
      .filter(({ dte }) => dte >= 21 && dte <= 60)
      .sort((a, b) => Math.abs(a.dte - 35) - Math.abs(b.dte - 35))[0];
    if (!expiration) return unavailable;

    const chain = await yahooFinance.options(yahooSymbol, { date: expiration.date });
    const option = chain.options[0];
    if (!option) return unavailable;
    const contracts = [...option.calls]
      .filter((contract) =>
        Math.abs(contract.strike - referencePrice) / referencePrice <= 0.12 &&
        (contract.bid ?? 0) > 0 &&
        (contract.ask ?? 0) > (contract.bid ?? 0),
      )
      .sort((left, right) => Math.abs(left.strike - referencePrice) - Math.abs(right.strike - referencePrice))
      .slice(0, 4);
    if (!contracts.length) return unavailable;

    const spreads = contracts.map((contract) => {
      const bid = contract.bid ?? 0;
      const ask = contract.ask ?? 0;
      const midpoint = (bid + ask) / 2;
      return midpoint > 0 && bid > 0 ? ((ask - bid) / midpoint) * 100 : 100;
    });
    const optionSpreadDollars = median(contracts.map((contract) => (contract.ask ?? 0) - (contract.bid ?? 0)));
    const optionSpreadPct = median(spreads);
    const optionIv = median(contracts.map((contract) => contract.impliedVolatility * 100));
    const optionOpenInterest = contracts.reduce((sum, contract) => sum + (contract.openInterest ?? 0), 0);
    const optionVolume = contracts.reduce((sum, contract) => sum + (contract.volume ?? 0), 0);
    const spreadScore = clamp(Math.max(100 - optionSpreadPct * 4, 100 - optionSpreadDollars * 250));
    const liquidityScore = clamp(Math.log10(optionOpenInterest + optionVolume + 1) * 28);
    const ivOpportunityScore = clamp((optionIv - 20) * 2);

    return {
      optionsAvailable: true,
      optionExpiration: expiration.date.toISOString().slice(0, 10),
      optionDte: expiration.dte,
      optionIv: Number(optionIv.toFixed(1)),
      optionSpreadDollars: Number(optionSpreadDollars.toFixed(2)),
      optionSpreadPct: Number(optionSpreadPct.toFixed(1)),
      optionOpenInterest,
      optionVolume,
      optionsTradabilityScore: Math.round(spreadScore * 0.6 + liquidityScore * 0.25 + ivOpportunityScore * 0.15),
    };
  } catch {
    return unavailable;
  }
}
