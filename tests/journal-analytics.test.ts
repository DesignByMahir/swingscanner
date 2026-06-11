import { describe, expect, it } from "vitest";
import { calculateJournalStats, tradePnl, tradeRMultiple } from "../src/lib/journal-analytics";
import type { JournalTrade } from "../src/types/domain";

const base: JournalTrade = {
  id: "1",
  symbol: "TEST",
  direction: "Long",
  status: "Closed",
  setup: "Breakout",
  openedAt: "2026-06-01",
  closedAt: "2026-06-02",
  quantity: 10,
  entryPrice: 100,
  exitPrice: 110,
  stopPrice: 95,
  fees: 2,
  confidence: 4,
  followedPlan: true,
  emotionBefore: "",
  emotionAfter: "",
  thesis: "",
  mistakes: "",
  lessons: "",
  tags: [],
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-02T00:00:00.000Z",
};

describe("journal analytics", () => {
  it("calculates long and short net P&L", () => {
    expect(tradePnl(base)).toBe(98);
    expect(tradePnl({ ...base, direction: "Short", entryPrice: 110, exitPrice: 100 })).toBe(98);
  });

  it("calculates R using stop-defined risk", () => {
    expect(tradeRMultiple(base)).toBeCloseTo(98 / 52);
  });

  it("summarizes win rate, expectancy, and adherence", () => {
    const loss = { ...base, id: "2", entryPrice: 100, exitPrice: 96, fees: 0, followedPlan: false };
    const stats = calculateJournalStats([base, loss]);
    expect(stats.winRate).toBe(50);
    expect(stats.netPnl).toBe(58);
    expect(stats.expectancy).toBe(29);
    expect(stats.planAdherence).toBe(50);
  });
});
