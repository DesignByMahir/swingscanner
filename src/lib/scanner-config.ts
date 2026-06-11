import type { ScannerRules } from "@/types/domain";

export const scannerRules: ScannerRules = {
  maxWatchlistItems: 5,
  maxScannerResults: Number(process.env.MAX_SCANNER_RESULTS ?? 50),
  maxUniverseSize: Number(process.env.SCAN_MAX_UNIVERSE ?? 5_000),
  enableYahooFallback: process.env.ENABLE_YAHOO_FALLBACK !== "false",
  dailyCacheHours: 20,
  minOptionIv: Number(process.env.MIN_OPTION_IV ?? 50),
  maxOptionSpreadDollars: Number(process.env.MAX_OPTION_SPREAD_DOLLARS ?? 1),
  maxOptionSpreadPct: Number(process.env.MAX_OPTION_SPREAD_PCT ?? 35),
  minOptionOpenInterest: Number(process.env.MIN_OPTION_OPEN_INTEREST ?? 10),
  minOptionsTradabilityScore: Number(process.env.MIN_OPTIONS_TRADABILITY_SCORE ?? 30),
  maxOptionsCandidates: Number(process.env.MAX_OPTIONS_CANDIDATES ?? 400),
};
