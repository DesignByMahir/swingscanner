import { getCached } from "@/lib/data/cache";
import { ProviderRouter } from "@/lib/data/provider-router";
import { ema } from "@/lib/scan/indicators";
import { normalizeScanResult } from "@/lib/scan/normalize-scan";
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
  const normalizedScan = scan ? normalizeScanResult(scan.value) : null;
  const normalizedTicker = ticker.toUpperCase();
  const scannedSetup = normalizedScan?.topSetups.find(
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
  // The scanner and ticker research both cache 300 sessions. Reusing that
  // history prevents a second provider request from making a valid setup 404.
  const result = await router.getDaily(setup.ticker, 300);
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
    `${setup.setupLabel} is the leadership label; ${setup.setup} is the current entry structure.`,
    `${setup.ticker} is ${setup.relative5Qqq >= 0 ? "outperforming" : "underperforming"} QQQ by ${Math.abs(setup.relative5Qqq).toFixed(1)}% over 5 days, ${setup.relative20Qqq >= 0 ? "outperforming" : "underperforming"} by ${Math.abs(setup.relative20Qqq).toFixed(1)}% over 20 days, and ${setup.relative63Qqq >= 0 ? "outperforming" : "underperforming"} by ${Math.abs(setup.relative63Qqq).toFixed(1)}% over 3 months.`,
    `Weekly structure is ${setup.weeklyTrendHealthy ? "healthy" : "mixed"} with price ${setup.distanceWeek8.toFixed(1)}% from the 8-week EMA at ${setup.weekEma8.toFixed(2)} and the 21-week EMA at ${setup.weekEma21.toFixed(2)}.`,
    `${setup.ticker} belongs to ${setup.canonicalTheme} within ${setup.sector} (${setup.sectorTicker}). Theme strength is ${setup.themeScore.toFixed(1)}/20 with ${setup.peerStrengthCount} strong peer${setup.peerStrengthCount === 1 ? "" : "s"}.`,
    setup.optionsAvailable ? `The selected ${setup.optionDte}-DTE near-the-money calls show ${setup.optionIv}% median IV, a $${setup.optionSpreadDollars} median bid/ask gap (${setup.optionSpreadPct}%), ${setup.optionOpenInterest} aggregate open interest, and an options tradability score of ${setup.optionsTradabilityScore}.` : "Usable 21-60 DTE options data was unavailable.",
    ...setup.reasons,
    `Trigger plan: ${setup.plan.trigger}.`,
    `After entry, ${setup.plan.stopRule.toLowerCase()}. Extension is ${setup.extension.toLowerCase()}; the score cap is ${setup.scoreCap}.`,
  ];

  return {
    setup,
    candles,
    thesis,
    marketDate: normalizedScan?.marketDate ?? researched!.value.marketDate,
    scanTimestamp: normalizedScan?.scanTimestamp ?? researched!.value.scanTimestamp,
  };
}
