"use client";

import {
  ArrowClockwise,
  ArrowSquareOut,
  ChartLineUp,
  Newspaper,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MarketIntelligence, MarketNewsItem, SectorPerformance } from "@/types/domain";
import { StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Timeframe = "change1d" | "change5d" | "change20d" | "change63d";
type NewsFilter = "all" | "watchlist" | "sector";

const timeframeOptions: Array<{ key: Timeframe; label: string }> = [
  { key: "change1d", label: "1D" },
  { key: "change5d", label: "5D" },
  { key: "change20d", label: "1M" },
  { key: "change63d", label: "3M" },
];

function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return null;
  const width = 150;
  const height = 38;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full min-w-28" role="img" aria-label="Thirty-session price trend">
      <polyline points={points} fill="none" stroke={positive ? "var(--positive)" : "var(--negative)"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function SectorRow({ sector, timeframe }: { sector: SectorPerformance; timeframe: Timeframe }) {
  const performance = sector[timeframe];
  return (
    <article className="grid gap-4 border-b px-4 py-4 last:border-b-0 hover:bg-secondary/35 md:grid-cols-[48px_minmax(190px,1.15fr)_minmax(130px,.7fr)_90px_110px_minmax(150px,.85fr)] md:items-center">
      <span className="metric-number text-xs text-muted-foreground">#{sector.rank}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <a href={`https://www.tradingview.com/chart/?symbol=AMEX%3A${sector.ticker}`} target="_blank" rel="noreferrer" className="font-mono font-semibold hover:text-primary">
            {sector.ticker}
          </a>
          <StatusBadge label={sector.signal} />
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">{sector.sector}</p>
      </div>
      <Sparkline values={sector.sparkline} positive={performance >= 0} />
      <p className={cn("metric-number text-base font-medium", performance >= 0 ? "text-positive" : "text-negative")}>{formatPercent(performance)}</p>
      <div>
        <p className={cn("metric-number text-sm", sector.relative20d >= 0 ? "text-positive" : "text-negative")}>{formatPercent(sector.relative20d)}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">vs SPY, 1M</p>
      </div>
      <div>
        <p className="metric-number text-sm">{sector.scannerCount} candidate{sector.scannerCount === 1 ? "" : "s"}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {sector.watchlistCount} on watchlist{sector.averageSetupScore !== null ? ` | ${sector.averageSetupScore.toFixed(0)} avg score` : ""}
        </p>
        {(sector.topSetups ?? []).length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(sector.topSetups ?? []).map((setup) => (
              <a
                key={setup.ticker}
                href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(setup.ticker)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded border px-1.5 py-1 font-mono text-[9px] text-muted-foreground hover:border-primary/50 hover:text-primary"
                title={`${setup.setup}, score ${setup.score}`}
              >
                {setup.ticker} · {setup.score}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function NewsCard({ item }: { item: MarketNewsItem }) {
  return (
    <article className="group flex h-full flex-col border-b border-r p-5 transition-colors hover:bg-secondary/35">
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className={item.scope === "watchlist" ? "text-primary" : ""}>{item.context}</span>
        <span>{relativeTime(item.publishedAt)}</span>
      </div>
      <h3 className="mt-4 text-base font-medium leading-6 text-pretty group-hover:text-primary">{item.title}</h3>
      <div className="mt-auto flex items-end justify-between gap-4 pt-6">
        <div>
          <p className="text-xs text-muted-foreground">{item.publisher}</p>
          {!!item.relatedTickers.length && <p className="mt-1 max-w-52 truncate font-mono text-[10px] text-muted-foreground">{item.relatedTickers.slice(0, 5).join(" · ")}</p>}
        </div>
        <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Read ${item.title}`} className="grid size-8 shrink-0 place-items-center rounded-md border text-muted-foreground hover:border-primary/50 hover:text-primary">
          <ArrowSquareOut size={15} />
        </a>
      </div>
    </article>
  );
}

export function SectorPulseView() {
  const [data, setData] = useState<MarketIntelligence | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("change20d");
  const [newsFilter, setNewsFilter] = useState<NewsFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/market-intelligence${forceRefresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; data?: MarketIntelligence; error?: { message: string } };
      if (!payload.ok || !payload.data) throw new Error(payload.error?.message ?? "Market context is unavailable.");
      setData(payload.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Market context is unavailable.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load(false), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const sectors = useMemo(
    () => [...(data?.sectors ?? [])]
      .sort((left, right) => right[timeframe] - left[timeframe])
      .map((sector, index) => ({ ...sector, rank: index + 1 })),
    [data, timeframe],
  );
  const topSixSectors = sectors.slice(0, 6);
  const news = useMemo(
    () => (data?.news ?? []).filter((item) => newsFilter === "all" || item.scope === newsFilter),
    [data, newsFilter],
  );
  const leaders = data?.sectors.filter((sector) => sector.signal === "Leading").length ?? 0;
  const positive = data?.sectors.filter((sector) => sector.change20d > 0).length ?? 0;
  const watchlistSectors = data?.sectors.filter((sector) => sector.watchlistCount > 0).length ?? 0;

  if (loading) {
    return <div className="panel grid min-h-80 place-items-center text-sm text-muted-foreground"><ArrowClockwise className="mr-2 inline animate-spin" /> Loading sector performance and headlines...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2"><ChartLineUp className="text-primary" weight="fill" /><h2 className="font-medium">Sector leadership</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">Completed daily candles through {data?.marketDate ?? "the latest market close"}.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border bg-background/60 p-1">
              {timeframeOptions.map((option) => (
                <button key={option.key} type="button" onClick={() => setTimeframe(option.key)} className={cn("rounded-md px-3 py-1.5 font-mono text-xs text-muted-foreground", timeframe === option.key && "bg-primary/12 text-primary")}>
                  {option.label}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
              <ArrowClockwise className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Refreshing" : "Refresh data"}
            </Button>
          </div>
        </div>

        <div className="grid border-b sm:grid-cols-3 sm:divide-x">
          <div className="p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Leading sectors</p><p className="metric-number mt-2 text-2xl text-positive">{leaders}</p></div>
          <div className="border-t p-4 sm:border-t-0"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Positive over 1M</p><p className="metric-number mt-2 text-2xl">{positive} / {data?.sectors.length ?? 0}</p></div>
          <div className="border-t p-4 sm:border-t-0"><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Watchlist participation</p><p className="metric-number mt-2 text-2xl">{watchlistSectors} sectors</p></div>
        </div>

        <div className="hidden grid-cols-[48px_minmax(190px,1.15fr)_minmax(130px,.7fr)_90px_110px_minmax(150px,.85fr)] gap-4 border-b bg-background/50 px-4 py-3 text-[9px] uppercase tracking-[0.14em] text-muted-foreground md:grid">
          <span>Rank</span><span>Sector</span><span>30-session trend</span><span>Return</span><span>Relative</span><span>Scanner confluence</span>
        </div>
        {topSixSectors.map((sector) => <SectorRow key={sector.ticker} sector={sector} timeframe={timeframe} />)}
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b p-4">
          <h2 className="font-medium">All sector coverage</h2>
          <p className="mt-1 text-xs text-muted-foreground">Every S&amp;P sector remains visible even when it has no current qualifying setups.</p>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3">
          {sectors.map((sector) => (
            <article key={sector.ticker} className="flex items-center gap-3 border-b border-r p-4">
              <span className="metric-number text-xs text-muted-foreground">#{sector.rank}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{sector.sector}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{sector.ticker} · {sector.scannerCount} setups</p>
              </div>
              <StatusBadge label={sector.signal} />
            </article>
          ))}
        </div>
      </section>

      {(error || data?.warnings.length) ? (
        <div className="flex gap-3 rounded-lg border border-warning/25 bg-warning/8 p-4 text-sm text-warning">
          <WarningCircle className="mt-0.5 shrink-0" />
          <p>{error ?? data?.warnings.join(" ")}</p>
        </div>
      ) : null}

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2"><Newspaper className="text-primary" weight="fill" /><h2 className="font-medium">News confluence</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">{data?.news.length ?? 0} deduplicated headlines from {data?.source}. Updates every 30 minutes.</p>
          </div>
          <div className="flex rounded-lg border bg-background/60 p-1">
            {(["all", "watchlist", "sector"] as NewsFilter[]).map((filter) => (
              <button key={filter} type="button" onClick={() => setNewsFilter(filter)} className={cn("rounded-md px-3 py-1.5 text-xs capitalize text-muted-foreground", newsFilter === filter && "bg-primary/12 text-primary")}>
                {filter === "all" ? "All news" : filter}
              </button>
            ))}
          </div>
        </div>
        {news.length ? (
          <div className="-mb-px -mr-px grid md:grid-cols-2 xl:grid-cols-3">
            {news.map((item) => <NewsCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="grid min-h-52 place-items-center p-8 text-center">
            <div><Newspaper className="mx-auto text-muted-foreground" size={26} /><p className="mt-3 font-medium">No matching headlines</p><p className="mt-2 text-sm text-muted-foreground">Refresh the feed or select another news filter.</p></div>
          </div>
        )}
        <div className="flex flex-col gap-2 border-t bg-background/40 px-4 py-3 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Watchlist: {data?.watchlistTickers.join(", ") || "Run a scan to populate ticker-specific news."}</span>
          {data && <span>Updated {new Date(data.generatedAt).toLocaleString()}</span>}
        </div>
      </section>
    </div>
  );
}
