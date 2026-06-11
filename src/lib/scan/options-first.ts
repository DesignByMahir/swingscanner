import type { DailyCandle, ScannerRules, StockSetup } from "../../types/domain";
import { clamp } from "../scoring";
import { distancePercent } from "./indicators";

export interface BaseBuilderEvidence {
  sample: DailyCandle[];
  quality: number;
  support: number;
  volumeContraction: number;
  tighteningPercent: number;
}

export function findBaseBuilder(
  candles: DailyCandle[],
  adrPct: number,
  ema8Value: number,
  ema21Value: number,
): BaseBuilderEvidence | null {
  const latest = candles.at(-1);
  if (!latest) return null;
  let best: BaseBuilderEvidence | null = null;

  for (let days = 4; days <= 15; days += 1) {
    const sample = candles.slice(-days);
    const priorVolumeBars = candles.slice(-(days + 20), -days);
    if (sample.length < days || priorVolumeBars.length < 10) continue;

    const earlier = sample.slice(0, Math.max(2, Math.ceil(days / 2)));
    const recent = sample.slice(Math.max(1, Math.floor(days / 2)));
    const beforeLatest = sample.slice(0, -1);
    const high = Math.max(...sample.map((bar) => bar.high));
    const low = Math.min(...sample.map((bar) => bar.low));
    const priorHigh = Math.max(...beforeLatest.map((bar) => bar.high));
    const priorLow = Math.min(...beforeLatest.map((bar) => bar.low));
    const baseRangePct = ((high - low) / latest.close) * 100;
    const earlierRange = Math.max(...earlier.map((bar) => bar.high)) - Math.min(...earlier.map((bar) => bar.low));
    const recentRange = Math.max(...recent.map((bar) => bar.high)) - Math.min(...recent.map((bar) => bar.low));
    const tighteningRatio = recentRange / Math.max(earlierRange, 0.01);
    const sampleVolume = sample.reduce((sum, bar) => sum + bar.volume, 0) / sample.length;
    const priorVolume = priorVolumeBars.reduce((sum, bar) => sum + bar.volume, 0) / priorVolumeBars.length;
    const recentVolume = recent.reduce((sum, bar) => sum + bar.volume, 0) / recent.length;
    const peakBaseVolume = Math.max(...sample.map((bar) => bar.volume));
    const volumeContraction = 1 - recentVolume / Math.max(priorVolume, 1);
    const latestContained = latest.high <= priorHigh * 1.012 && latest.low >= priorLow * 0.992;
    const emaInsideBase = [ema8Value, ema21Value].some((value) => value >= low * 0.995 && value <= high * 1.005);
    const closeNearEma = Math.min(
      Math.abs(distancePercent(latest.close, ema8Value)),
      Math.abs(distancePercent(latest.close, ema21Value)),
    ) <= Math.max(adrPct * 0.8, 1.5);
    const nearResistance = high - latest.close <= latest.close * adrPct / 100;
    const earlierLow = Math.min(...earlier.map((bar) => bar.low));
    const recentLow = Math.min(...recent.map((bar) => bar.low));
    const risingLows = recentLow >= earlierLow * 1.01;
    const resistanceTolerance = Math.max(latest.close * adrPct / 100 * 0.25, latest.close * 0.006);
    const resistanceTouches = sample.filter((bar) => high - bar.high <= resistanceTolerance).length;
    const rangeTightening = tighteningRatio <= 0.88;
    const ascendingPressure = risingLows && tighteningRatio <= 1.15;
    const rangeCompression = clamp((1 - tighteningRatio) * 100);
    const risingLowCompression = risingLows
      ? clamp(((recentLow - earlierLow) / Math.max(high - earlierLow, 0.01)) * 100)
      : 0;
    const volumeDrying =
      (sampleVolume <= priorVolume * 0.88 && recentVolume <= priorVolume * 0.82) ||
      (recentVolume <= peakBaseVolume * 0.72 && latest.volume <= peakBaseVolume * 0.78);

    if (
      baseRangePct > Math.max(adrPct * 3.2, 7) ||
      (!rangeTightening && !ascendingPressure) ||
      !latestContained ||
      (!emaInsideBase && !closeNearEma) ||
      !nearResistance ||
      resistanceTouches < 2 ||
      !volumeDrying
    ) continue;

    const quality = clamp(
      72 +
      Math.min(days - 4, 6) * 2 +
      clamp((1 - tighteningRatio) * 35, 0, 14) +
      clamp(volumeContraction * 35, 0, 12) -
      clamp(baseRangePct / Math.max(adrPct, 0.1), 0, 8) +
      Math.min(resistanceTouches, 4) * 1.5 +
      Number(risingLows) * 5,
    );
    const evidence = {
      sample,
      quality,
      support: Math.max(low, Math.min(ema8Value, ema21Value)),
      volumeContraction: clamp(volumeContraction * 100),
      tighteningPercent: Math.max(rangeCompression, risingLowCompression),
    };
    if (!best || evidence.quality > best.quality) best = evidence;
  }

  return best;
}

export function passesOptionsGate(stock: StockSetup, rules: ScannerRules) {
  return (
    stock.optionsAvailable &&
    stock.optionSpreadDollars != null &&
    stock.optionSpreadDollars <= rules.maxOptionSpreadDollars &&
    stock.optionSpreadPct != null &&
    stock.optionSpreadPct <= rules.maxOptionSpreadPct
  );
}
