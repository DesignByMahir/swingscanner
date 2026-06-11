import { describe, expect, it } from "vitest";
import { parseStooqCsv, toStooqSymbol } from "../src/lib/data/providers/stooq-provider";
import { getSectorTheme } from "../src/lib/data/sector-theme-map";
import { completedDailyCandles } from "../src/lib/data/provider-router";
import { bollingerBandwidthPercentile } from "../src/lib/scan/indicators";

describe("free data providers", () => {
  it("converts safe Stooq symbols", () => {
    expect(toStooqSymbol("AAPL")).toBe("aapl.us");
    expect(toStooqSymbol("BRK.B")).toBe("brk-b.us");
  });

  it("rejects verification pages and parses valid CSV", () => {
    expect(parseStooqCsv("<html>requires JavaScript to verify</html>")).toBeNull();
    const rows = Array.from({ length: 60 }, (_, index) => `2026-01-${String((index % 28) + 1).padStart(2, "0")},10,12,9,11,1000000`);
    const parsed = parseStooqCsv(`Date,Open,High,Low,Close,Volume\n${rows.join("\n")}`);
    expect(parsed).toHaveLength(60);
    expect(parsed?.[0].close).toBe(11);
  });

  it("classifies every stock without unmapped placeholders", () => {
    expect(getSectorTheme("NVDA").theme).toBe("Semiconductors");
    expect(getSectorTheme("ZZZZ", "Example Consumer Services Inc.")).toEqual({
      sector: "Consumer Discretionary",
      sectorTicker: "XLY",
      theme: "Consumer products and services",
      themeSlug: "consumer-products-and-services",
    });
  });

  it("excludes the active New York daily bar before settlement", () => {
    const candles = [
      { date: "2026-06-09", open: 10, high: 12, low: 9, close: 11, volume: 100 },
      { date: "2026-06-10", open: 11, high: 13, low: 10, close: 12, volume: 50 },
    ];
    expect(completedDailyCandles(candles, new Date("2026-06-10T14:30:00Z"))).toHaveLength(1);
    expect(completedDailyCandles(candles, new Date("2026-06-10T20:20:00Z"))).toHaveLength(2);
  });

  it("identifies low Bollinger bandwidth relative to recent history", () => {
    const volatile = Array.from({ length: 120 }, (_, index) => 100 + Math.sin(index) * 12);
    const compressed = Array.from({ length: 40 }, (_, index) => 100 + Math.sin(index) * 0.5);
    const squeeze = bollingerBandwidthPercentile([...volatile, ...compressed]);
    expect(squeeze).not.toBeNull();
    expect(squeeze!.percentile).toBeLessThanOrEqual(0.2);
  });
});
