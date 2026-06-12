import { describe, expect, it } from "vitest";
import type { DailyCandle } from "../src/types/domain";
import {
  classifyMarketTheme,
  scoreLeaderEvidence,
  type BenchmarkReturns,
  type SectorContext,
} from "../src/lib/scan/leader-scoring";

const neutralBenchmarks: BenchmarkReturns = {
  spy5: 1,
  spy20: 3,
  spy63: 7,
  qqq5: 1.5,
  qqq20: 4,
  qqq63: 9,
};

const leadingSector: SectorContext = {
  score: 82,
  rank: 2,
  change1d: 1.2,
  change5d: 5,
  change20d: 12,
  relative20d: 8,
};

function history({
  start = 20,
  dailyGrowth = 0.004,
  finalMultiplier = 1,
  finalVolumeMultiplier = 1,
}: {
  start?: number;
  dailyGrowth?: number;
  finalMultiplier?: number;
  finalVolumeMultiplier?: number;
} = {}): DailyCandle[] {
  const candles: DailyCandle[] = [];
  let close = start;
  for (let index = 0; index < 260; index += 1) {
    close *= 1 + dailyGrowth + Math.sin(index / 9) * 0.0015;
    const open = close * (index % 3 === 0 ? 0.994 : 0.998);
    candles.push({
      date: new Date(Date.UTC(2025, 0, 2 + index)).toISOString().slice(0, 10),
      open,
      high: Math.max(open, close) * 1.018,
      low: Math.min(open, close) * 0.982,
      close,
      volume: 2_000_000 + (index % 11) * 45_000,
    });
  }
  const latest = candles.at(-1)!;
  latest.close *= finalMultiplier;
  latest.open = latest.close * (finalMultiplier < 1 ? 1.025 : 0.985);
  latest.high = Math.max(latest.open, latest.close) * 1.01;
  latest.low = Math.min(latest.open, latest.close) * 0.985;
  latest.volume *= finalVolumeMultiplier;
  return candles;
}

describe("leader-first scoring", () => {
  it("classifies high-priority market themes", () => {
    expect(classifyMarketTheme("ALAB", "Astera Labs", "Semiconductors")).toBe("Semiconductors");
    expect(classifyMarketTheme("LRCX", "Lam Research Corporation", "Industrial Machinery/Components")).toBe("Semiconductors");
    expect(classifyMarketTheme("VRT", "Vertiv Holdings", "Data center power solutions")).toBe("Data Centers");
    expect(classifyMarketTheme("IONQ", "IonQ", "Quantum computing systems")).toBe("Quantum Computing");
  });

  it("keeps extended leaders visible but penalizes their daily entry quality", () => {
    const actionable = scoreLeaderEvidence({
      ticker: "ALAB",
      company: "Astera Labs",
      industry: "Semiconductors",
      candles: history(),
      benchmarks: neutralBenchmarks,
      sector: leadingSector,
      peerStrengthCount: 4,
    })!;
    const extended = scoreLeaderEvidence({
      ticker: "ALAB",
      company: "Astera Labs",
      industry: "Semiconductors",
      candles: history({ finalMultiplier: 1.35 }),
      benchmarks: neutralBenchmarks,
      sector: leadingSector,
      peerStrengthCount: 4,
    })!;

    expect(actionable.setup).not.toBe("Extended / Wait");
    expect(extended.setup).toBe("Extended / Wait");
    expect(extended.dailySetupScore).toBeLessThanOrEqual(14);
  });

  it("recognizes a strong semiconductor leader and keeps it eligible for a top score", () => {
    const evidence = scoreLeaderEvidence({
      ticker: "ALAB",
      company: "Astera Labs",
      industry: "Semiconductors",
      candles: history(),
      benchmarks: neutralBenchmarks,
      sector: leadingSector,
      peerStrengthCount: 4,
    });
    expect(evidence).not.toBeNull();
    expect(evidence!.outperformingMarket).toBe(true);
    expect(evidence!.strongTheme).toBe(true);
    expect(evidence!.scoreCap).toBe(100);
    expect(evidence!.marketLeadershipScore).toBeGreaterThan(18);
  });

  it("caps a chart that underperforms both SPY and QQQ at 65", () => {
    const evidence = scoreLeaderEvidence({
      ticker: "SLOW",
      company: "Slow Company",
      industry: "Consumer products",
      candles: history({ dailyGrowth: 0.0001 }),
      benchmarks: neutralBenchmarks,
      sector: leadingSector,
    });
    expect(evidence).not.toBeNull();
    expect(evidence!.scoreCap).toBeLessThanOrEqual(65);
    expect(evidence!.capReasons).toContain("Underperforming both SPY and QQQ");
  });

  it("caps a declining 8-week EMA structure at 60", () => {
    const evidence = scoreLeaderEvidence({
      ticker: "DOWN",
      company: "Downtrend Systems",
      industry: "Software",
      candles: history({ start: 100, dailyGrowth: -0.002 }),
      benchmarks: {
        spy5: -10,
        spy20: -20,
        spy63: -30,
        qqq5: -10,
        qqq20: -20,
        qqq63: -30,
      },
      sector: leadingSector,
      peerStrengthCount: 3,
    });
    expect(evidence).not.toBeNull();
    expect(evidence!.scoreCap).toBeLessThanOrEqual(60);
    expect(evidence!.capReasons).toContain("8-week EMA is declining");
  });

  it("marks a heavy-volume loss of the 8-week EMA as broken and caps it at 55", () => {
    const evidence = scoreLeaderEvidence({
      ticker: "BROKE",
      company: "Broken Leader",
      industry: "Semiconductors",
      candles: history({ finalMultiplier: 0.72, finalVolumeMultiplier: 3 }),
      benchmarks: neutralBenchmarks,
      sector: leadingSector,
      peerStrengthCount: 4,
    });
    expect(evidence).not.toBeNull();
    expect(evidence!.setupLabel).toBe("Broken Leader - Lost 8W EMA");
    expect(evidence!.scoreCap).toBeLessThanOrEqual(55);
  });
});
