import type { DailyCandle } from "@/types/domain";

export function sma(values: number[], period: number) {
  if (values.length < period) return null;
  return values.slice(-period).reduce((sum, value) => sum + value, 0) / period;
}

export function ema(values: number[], period: number) {
  if (values.length < period) return null;
  let value = values.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
  const multiplier = 2 / (period + 1);
  for (const item of values.slice(period)) value = item * multiplier + value * (1 - multiplier);
  return value;
}

export function rsi(values: number[], period = 14) {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return 100 - 100 / (1 + rs);
}

export function adr(candles: DailyCandle[], period = 20) {
  const sample = candles.slice(-period);
  if (sample.length < period) return null;
  return sample.reduce((sum, bar) => sum + ((bar.high - bar.low) / bar.close) * 100, 0) / sample.length;
}

export function averageVolume(candles: DailyCandle[], period = 20) {
  return sma(candles.map((bar) => bar.volume), period);
}

export function changePercent(values: number[], lookback: number) {
  if (values.length <= lookback) return 0;
  return ((values.at(-1)! / values[values.length - 1 - lookback]) - 1) * 100;
}

export function distancePercent(price: number, average: number) {
  return ((price / average) - 1) * 100;
}

export function bollingerBandwidthPercentile(values: number[], period = 20, lookback = 120) {
  if (values.length < period + lookback) return null;
  const bandwidths: number[] = [];
  for (let index = period - 1; index < values.length; index += 1) {
    const sample = values.slice(index - period + 1, index + 1);
    const mean = sample.reduce((sum, value) => sum + value, 0) / period;
    const deviation = Math.sqrt(sample.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period);
    bandwidths.push((deviation * 4 / mean) * 100);
  }
  const current = bandwidths.at(-1)!;
  const history = bandwidths.slice(-lookback - 1, -1);
  const percentile = history.filter((value) => value <= current).length / history.length;
  return { bandwidth: current, percentile };
}
