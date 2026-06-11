"use client";

import { ArrowClockwise, ArrowSquareOut, Star } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FreeScanResult, StockSetup } from "@/types/domain";
import { money } from "@/lib/format";
import { EmptyState, ScoreBadge, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";

export function WatchlistView() {
  const [stocks, setStocks] = useState<StockSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/scan/latest", { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; data?: FreeScanResult; error?: { message: string } };
      if (!payload.ok || !payload.data) throw new Error(payload.error?.message ?? "No live watchlist is available.");
      setStocks(payload.data.watchlist);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No live watchlist is available.");
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) return <div className="panel grid min-h-64 place-items-center text-sm text-muted-foreground"><ArrowClockwise className="mr-2 inline animate-spin" /> Loading live watchlist...</div>;
  if (!stocks.length) {
    return (
      <div>
        <EmptyState title="No live watchlist is available" description={error ?? "Run the live scanner to generate the focused list."} />
        <div className="mt-3 flex justify-center"><Button variant="outline" onClick={load}><ArrowClockwise /> Try again</Button></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stocks.map((stock, index) => (
        <div key={stock.ticker} className="panel grid gap-5 p-5 xl:grid-cols-[44px_170px_1.25fr_1fr_180px] xl:items-center">
          <span className="metric-number text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <Link href={`/setups/${encodeURIComponent(stock.ticker)}`} className="font-mono text-lg font-semibold hover:text-primary">{stock.ticker}</Link>
            <p className="mt-1 truncate text-xs text-muted-foreground">{stock.company}</p>
            <p className="metric-number mt-2 text-sm">{money(stock.price)}</p>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><Link href={`/setups/${encodeURIComponent(stock.ticker)}`}><StatusBadge label={stock.setup} /></Link><StatusBadge label={stock.extension} /></div>
            <p className="mt-3 text-sm">{stock.plan.trigger}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stock.sector} | {stock.theme}</p>
            <p className="mt-2 text-xs text-muted-foreground">Options: {stock.optionsAvailable ? `${stock.optionIv}% IV / $${stock.optionSpreadDollars} spread / ${stock.optionsTradabilityScore} score` : "Unavailable"}</p>
            {stock.marketCapUnavailable && <p className="mt-2 text-[10px] text-warning">Market cap is not supplied by the free candle provider.</p>}
          </div>
          <div className="grid grid-cols-3 divide-x rounded-lg border bg-background/50">
            <div className="p-3"><p className="text-[9px] uppercase text-muted-foreground">Breakout</p><p className="metric-number mt-1 text-xs">{(stock.plan.breakoutLevel ?? stock.plan.entryLow).toFixed(2)}</p></div>
            <div className="p-3"><p className="text-[9px] uppercase text-muted-foreground">{stock.plan.alternateTrigger < stock.plan.breakoutLevel ? "Descending line" : "Key level"}</p><p className="metric-number mt-1 text-xs text-warning">{(stock.plan.alternateTrigger ?? stock.plan.entryLow).toFixed(2)}</p></div>
            <div className="p-3"><p className="text-[9px] uppercase text-muted-foreground">Tightening</p><p className="metric-number mt-1 text-xs text-positive">{(stock.tighteningPercent ?? stock.plan.tighteningPercent ?? 0).toFixed(0)}%</p></div>
          </div>
          <div className="flex items-center justify-between xl:block xl:text-right">
            <ScoreBadge score={stock.finalScore} className="text-sm" />
            <p className="mt-2 text-xs text-muted-foreground">Stop reference: breakout day low</p>
            <Button asChild size="sm" className="mt-3"><Link href={`/setups/${encodeURIComponent(stock.ticker)}`}>View setup</Link></Button>
            <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(stock.ticker)}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">TradingView <ArrowSquareOut /></a>
          </div>
        </div>
      ))}
      <div className="flex justify-between pt-2 text-xs text-muted-foreground">
        <span><Star className="mr-1 inline text-primary" weight="fill" /> Generated only from the latest live scan.</span>
        <Button variant="ghost" size="sm" onClick={load}><ArrowClockwise /> Refresh</Button>
      </div>
    </div>
  );
}
