import { describe, expect, it } from "vitest";
import { findBaseBuilder, passesOptionsGate } from "../src/lib/scan/options-first";
import { findHorizontalResistance, setupGeometry } from "../src/lib/scan/setup-geometry";
import type { DailyCandle, ScannerRules, StockSetup } from "../src/types/domain";

const rules: ScannerRules = {
  maxWatchlistItems: 7,
  maxScannerResults: 50,
  maxUniverseSize: 5_000,
  enableYahooFallback: true,
  dailyCacheHours: 20,
  minOptionIv: 50,
  maxOptionSpreadDollars: 1,
  maxOptionSpreadPct: 35,
  minOptionOpenInterest: 50,
  minOptionsTradabilityScore: 50,
  maxOptionsCandidates: 400,
};

function candle(index: number, high: number, low: number, close: number, volume: number): DailyCandle {
  return {
    date: `2026-05-${String(index + 1).padStart(2, "0")}`,
    open: close - 0.2,
    high,
    low,
    close,
    volume,
  };
}

describe("options-first base scanner", () => {
  it("detects a contained four-day-plus base with tightening price and volume", () => {
    const history = Array.from({ length: 220 }, (_, index) => candle(index % 28, 101.5, 98.5, 100, 1_000_000));
    const base = [
      candle(21, 102, 98, 100.2, 760_000),
      candle(22, 101.8, 98.4, 100.4, 680_000),
      candle(23, 101.5, 98.8, 100.6, 590_000),
      candle(24, 101.3, 99.1, 100.7, 500_000),
      candle(25, 101.2, 99.3, 100.8, 430_000),
      candle(26, 101.1, 99.5, 100.9, 380_000),
    ];
    const result = findBaseBuilder([...history, ...base], 3, 100.5, 99.8);
    expect(result).not.toBeNull();
    expect(result!.sample.length).toBeGreaterThanOrEqual(4);
  });

  it("detects a BTDR-style ascending base pressing into horizontal resistance", () => {
    const history = Array.from({ length: 210 }, (_, index) => candle(index % 28, 12.8, 11.8, 12.3, 6_100_000));
    const btdrBase = [
      candle(5, 15.11, 12.95, 15.10, 14_380_100),
      candle(6, 14.90, 13.34, 13.84, 6_815_300),
      candle(7, 13.95, 12.97, 13.47, 5_939_400),
      candle(10, 13.67, 12.88, 13.17, 6_721_800),
      candle(11, 13.16, 12.28, 12.83, 7_560_000),
      candle(12, 13.39, 12.48, 13.22, 6_986_300),
      candle(13, 14.87, 12.64, 14.75, 14_133_100),
      candle(14, 14.40, 12.95, 13.35, 8_047_400),
      candle(17, 13.58, 12.34, 13.15, 8_067_000),
      candle(18, 13.04, 12.20, 12.83, 9_894_300),
      candle(19, 13.75, 12.83, 13.28, 7_089_900),
      candle(20, 14.99, 13.30, 14.92, 9_454_000),
      candle(21, 15.27, 14.36, 14.65, 7_944_800),
    ];
    const result = findBaseBuilder([...history, ...btdrBase], 7.96, 13.85, 13.09);
    expect(result).not.toBeNull();
    expect(result!.sample.length).toBeGreaterThanOrEqual(10);
  });

  it("uses a one-dollar preferred ceiling for options liquidity", () => {
    const stock = {
      optionsAvailable: true,
      optionIv: 55,
      optionSpreadDollars: 0.5,
      optionSpreadPct: 20,
      optionOpenInterest: 600,
      optionsTradabilityScore: 80,
    } as StockSetup;
    expect(passesOptionsGate(stock, rules)).toBe(true);
    expect(passesOptionsGate({ ...stock, optionSpreadDollars: 1.01 }, rules)).toBe(false);
    expect(passesOptionsGate({ ...stock, optionSpreadPct: 36 }, rules)).toBe(false);
    expect(passesOptionsGate({ ...stock, optionSpreadPct: 7 }, rules)).toBe(true);
  });

  it("prefers repeated horizontal resistance over a single outlier wick", () => {
    const sample = [
      candle(1, 26.5, 24.3, 25.7, 1_000_000),
      candle(2, 26.39, 21.5, 24, 900_000),
      candle(3, 23.21, 21, 21.5, 800_000),
      candle(4, 22.79, 20.3, 22.1, 700_000),
      candle(5, 21.95, 19.2, 19.6, 650_000),
      candle(6, 21.25, 18.5, 18.8, 600_000),
      candle(7, 18.58, 15.1, 15.8, 550_000),
      candle(8, 17.2, 15.7, 16.2, 500_000),
      candle(9, 20.4, 14.7, 19.4, 850_000),
      candle(10, 23.63, 19.1, 22.68, 1_100_000),
    ];
    const resistance = findHorizontalResistance(sample, 3.42);
    expect(resistance.touches).toBeGreaterThanOrEqual(2);
    expect(resistance.level).toBeGreaterThan(23);
    expect(resistance.level).toBeLessThan(24);
  });

  it("never exposes an ascending resistance line as a breakout trigger", () => {
    const rising = [
      candle(1, 20, 18, 19, 500_000),
      candle(2, 20.5, 18.5, 19.5, 480_000),
      candle(3, 21, 19, 20, 460_000),
      candle(4, 21.5, 19.5, 20.5, 440_000),
    ];
    const geometry = setupGeometry(rising, rising.at(-1)!, 1);
    expect(geometry.hasDescendingTrendline).toBe(false);
    expect(geometry.alternateTrigger).toBe(geometry.breakoutLevel);
  });

  it("does not expose a descending line that price already cleared", () => {
    const stale = [
      candle(1, 26.5, 24, 25.7, 500_000),
      candle(2, 24.8, 22, 24, 480_000),
      candle(3, 22, 18, 20, 460_000),
      candle(4, 18, 15, 22.7, 440_000),
    ];
    const geometry = setupGeometry(stale, stale.at(-1)!, 3.4);
    expect(geometry.hasDescendingTrendline).toBe(false);
    expect(geometry.alternateTrigger).toBe(geometry.breakoutLevel);
  });
});
