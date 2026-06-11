import { getCached } from "@/lib/data/cache";
import { ProviderRouter } from "@/lib/data/provider-router";
import { ema } from "@/lib/scan/indicators";
import type { DailyCandle, FreeScanResult, StockSetup } from "@/types/domain";

export interface SetupChartCandle extends DailyCandle {
  ema8: number | null;
  ema21: number | null;
  ema50: number | null;
}

export interface SetupDetail {
  setup: StockSetup;
  candles: SetupChartCandle[];
  thesis: string[];
  marketDate: string;
  scanTimestamp: string;
}

interface ResearchedSetupCache {
  setup: StockSetup;
  marketDate: string;
  scanTimestamp: string;
}

function emaSeries(values: number[], period: number) {
  return values.map((_, index) => ema(values.slice(0, index + 1), period));
}

export async function getSetupDetail(ticker: string): Promise<SetupDetail | null> {
  const scan = await getCached<FreeScanResult>("scan:free-eod:latest", true);
  const normalizedTicker = ticker.toUpperCase();
  const scannedSetup = scan?.value.topSetups.find(
    (item) => item.ticker === normalizedTicker,
  );
  const researched = scannedSetup
    ? null
    : await getCached<ResearchedSetupCache>(
      `research:setup:${normalizedTicker}`,
      true,
    );
  const setup = scannedSetup ?? researched?.value.setup;
  if (!setup) return null;

  const router = new ProviderRouter({ enableYahooFallback: true, dailyCacheHours: 20 });
  const result = await router.getDaily(setup.ticker, 500);
  if (!result.candles) return null;
  const closes = result.candles.map((candle) => candle.close);
  const ema8 = emaSeries(closes, 8);
  const ema21 = emaSeries(closes, 21);
  const ema50 = emaSeries(closes, 50);
  const candles = result.candles.slice(-260).map((candle, visibleIndex) => {
    const sourceIndex = result.candles!.length - Math.min(260, result.candles!.length) + visibleIndex;
    return { ...candle, ema8: ema8[sourceIndex], ema21: ema21[sourceIndex], ema50: ema50[sourceIndex] };
  });

  const thesis = [
    `${setup.setup} is the primary pattern; ${setup.matchedSetups.length} supported pattern${setup.matchedSetups.length === 1 ? "" : "s"} matched.`,
    `This is a completed-daily-candle structure built over approximately ${setup.plan.baseDays ?? 0} sessions, with horizontal resistance at ${(setup.plan.breakoutLevel ?? setup.plan.entryLow).toFixed(2)} and an earlier trendline trigger near ${(setup.plan.alternateTrigger ?? setup.plan.entryLow).toFixed(2)}.`,
    `The recent range tightened by approximately ${(setup.tighteningPercent ?? setup.plan.tighteningPercent ?? 0).toFixed(0)}% versus the earlier base range.`,
    `${setup.ticker} is classified in ${setup.sector} (${setup.sectorTicker}), with ${setup.theme} as its industry/theme. Sector strength contributes ${Math.round(setup.scoreParts.find((part) => part.label === "Sector strength")?.value ?? 50)} points to the ranking context.`,
    setup.optionsAvailable ? `The selected ${setup.optionDte}-DTE near-the-money calls show ${setup.optionIv}% median IV, a $${setup.optionSpreadDollars} median bid/ask gap (${setup.optionSpreadPct}%), ${setup.optionOpenInterest} aggregate open interest, and an options tradability score of ${setup.optionsTradabilityScore}.` : "Usable 21-60 DTE options data was unavailable.",
    ...setup.reasons,
    `The optimal trigger is the horizontal breakout through ${(setup.plan.breakoutLevel ?? setup.plan.entryLow).toFixed(2)}; the earlier alternative is the resistance trendline near ${(setup.plan.alternateTrigger ?? setup.plan.entryLow).toFixed(2)}.`,
    `After entry, the stop reference is the breakout day's low. Extension is ${setup.extension.toLowerCase()}.`,
  ];

  return {
    setup,
    candles,
    thesis,
    marketDate: scan?.value.marketDate ?? researched!.value.marketDate,
    scanTimestamp: scan?.value.scanTimestamp ?? researched!.value.scanTimestamp,
  };
}
