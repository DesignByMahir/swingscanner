import type { JournalStats, JournalTrade } from "@/types/domain";

export function tradePnl(trade: JournalTrade) {
  if (trade.status !== "Closed" || trade.exitPrice <= 0) return 0;
  const direction = trade.direction === "Long" ? 1 : -1;
  return (trade.exitPrice - trade.entryPrice) * trade.quantity * direction - trade.fees;
}

export function tradeRisk(trade: JournalTrade) {
  if (trade.stopPrice <= 0) return 0;
  return Math.abs(trade.entryPrice - trade.stopPrice) * trade.quantity + trade.fees;
}

export function tradeRMultiple(trade: JournalTrade) {
  const risk = tradeRisk(trade);
  return risk > 0 && trade.status === "Closed" ? tradePnl(trade) / risk : null;
}

export function calculateJournalStats(trades: JournalTrade[]): JournalStats {
  const closed = trades
    .filter((trade) => trade.status === "Closed")
    .sort((a, b) => (a.closedAt || a.openedAt).localeCompare(b.closedAt || b.openedAt));
  const pnls = closed.map(tradePnl);
  const winning = pnls.filter((pnl) => pnl > 0);
  const losing = pnls.filter((pnl) => pnl < 0);
  const wins = winning.length;
  const losses = losing.length;
  const grossProfit = winning.reduce((sum, pnl) => sum + pnl, 0);
  const grossLoss = Math.abs(losing.reduce((sum, pnl) => sum + pnl, 0));
  const rMultiples = closed.map(tradeRMultiple).filter((value): value is number => value !== null);

  let currentStreak = 0;
  let bestWinStreak = 0;
  let runningWins = 0;
  for (const pnl of pnls) {
    if (pnl > 0) {
      runningWins += 1;
      bestWinStreak = Math.max(bestWinStreak, runningWins);
    } else {
      runningWins = 0;
    }
  }
  if (pnls.length) {
    const latestResult = pnls.at(-1) ?? 0;
    for (let index = pnls.length - 1; index >= 0; index -= 1) {
      if (latestResult > 0 && pnls[index] > 0) currentStreak += 1;
      else if (latestResult < 0 && pnls[index] < 0) currentStreak -= 1;
      else if (latestResult === 0 && pnls[index] === 0) continue;
      else break;
    }
  }

  const netPnl = pnls.reduce((sum, pnl) => sum + pnl, 0);
  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.length - closed.length,
    wins,
    losses,
    breakeven: closed.length - wins - losses,
    winRate: closed.length ? (wins / closed.length) * 100 : 0,
    grossPnl: grossProfit - grossLoss,
    netPnl,
    averageWin: wins ? grossProfit / wins : 0,
    averageLoss: losses ? -grossLoss / losses : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    expectancy: closed.length ? netPnl / closed.length : 0,
    averageR: rMultiples.length ? rMultiples.reduce((sum, value) => sum + value, 0) / rMultiples.length : null,
    planAdherence: trades.length ? (trades.filter((trade) => trade.followedPlan).length / trades.length) * 100 : 0,
    currentStreak,
    bestWinStreak,
  };
}
