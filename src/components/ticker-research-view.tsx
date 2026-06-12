"use client";

import {
  ArrowSquareOut,
  ChartLine,
  MagnifyingGlass,
  SpinnerGap,
} from "@phosphor-icons/react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { ScoreBadge, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compact, money, percent } from "@/lib/format";
import type { DailyCandle, TickerResearchResult } from "@/types/domain";

type ResearchResponse =
  | { ok: true; data: TickerResearchResult }
  | { ok: false; error: { message: string } };

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border bg-background/55 p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="metric-number mt-2 text-lg font-semibold">{value}</p>
      {detail && (
        <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}

function calculateEma(values: number[], period: number) {
  const result: Array<number | null> = [];
  let current: number | null = null;
  const multiplier = 2 / (period + 1);
  values.forEach((value, index) => {
    if (index < period - 1) result.push(null);
    else if (index === period - 1) {
      current = values.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
      result.push(current);
    } else {
      current = value * multiplier + current! * (1 - multiplier);
      result.push(current);
    }
  });
  return result;
}

function aggregateWeekly(candles: DailyCandle[]) {
  const groups = new Map<string, DailyCandle[]>();
  candles.forEach((candle) => {
    const date = new Date(`${candle.date}T00:00:00Z`);
    const day = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
    const key = date.toISOString().slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), candle]);
  });
  return [...groups.entries()].map(([date, bars]) => ({
    date,
    open: bars[0].open,
    high: Math.max(...bars.map((bar) => bar.high)),
    low: Math.min(...bars.map((bar) => bar.low)),
    close: bars.at(-1)!.close,
    volume: bars.reduce((sum, bar) => sum + bar.volume, 0),
  }));
}

function ResearchChart({ result }: { result: TickerResearchResult }) {
  const [timeframe, setTimeframe] = useState<"daily" | "weekly">("daily");
  const candles = useMemo(() => {
    const source = timeframe === "daily" ? result.candles : aggregateWeekly(result.candles);
    return source.slice(timeframe === "daily" ? -90 : -80);
  }, [result.candles, timeframe]);
  const closes = candles.map((candle) => candle.close);
  const ema8 = calculateEma(closes, 8);
  const ema21 = calculateEma(closes, 21);
  const ema50 = calculateEma(closes, 50);
  const width = 1000;
  const height = 500;
  const left = 18;
  const right = 76;
  const top = 20;
  const priceBottom = 350;
  const volumeTop = 375;
  const volumeBottom = 472;
  const plotRight = width - right;
  const plotWidth = plotRight - left;
  const prices = candles.flatMap((candle) => [candle.low, candle.high]);
  const minPrice = Math.min(...prices) * 0.985;
  const maxPrice = Math.max(...prices) * 1.015;
  const maxVolume = Math.max(...candles.map((candle) => candle.volume), 1);
  const x = (index: number) => left + (index + 0.5) * plotWidth / candles.length;
  const y = (price: number) => top + (maxPrice - price) / (maxPrice - minPrice) * (priceBottom - top);
  const candleWidth = Math.max(2, plotWidth / candles.length * 0.62);
  const gridPrices = Array.from({ length: 6 }, (_, index) => minPrice + (maxPrice - minPrice) * index / 5);
  const pathFor = (values: Array<number | null>) => values
    .map((value, index) => value == null ? null : `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
    .filter(Boolean)
    .join(" ");

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <p className="text-sm font-medium">{result.ticker} completed {timeframe} chart</p>
          <p className="mt-1 text-xs text-muted-foreground">{candles.length} candles through {result.marketDate} with volume</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={timeframe === "daily" ? "default" : "outline"} onClick={() => setTimeframe("daily")}>Daily</Button>
          <Button size="sm" variant={timeframe === "weekly" ? "default" : "outline"} onClick={() => setTimeframe("weekly")}>Weekly</Button>
        </div>
      </div>
      <div className="overflow-x-auto p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px] w-full" role="img" aria-label={`${result.ticker} ${timeframe} candlestick chart`}>
          <rect width={width} height={height} fill="var(--chart-bg)" rx="10" />
          {gridPrices.map((price) => <g key={price}><line x1={left} x2={plotRight} y1={y(price)} y2={y(price)} stroke="var(--chart-grid)" strokeDasharray="3 5" /><text x={plotRight + 8} y={y(price) + 4} fill="var(--chart-label)" fontSize="11" fontFamily="monospace">{price.toFixed(2)}</text></g>)}
          {candles.map((candle, index) => {
            const rising = candle.close >= candle.open;
            const color = rising ? "var(--chart-up)" : "var(--chart-down)";
            const bodyTop = y(Math.max(candle.open, candle.close));
            const bodyHeight = Math.max(1.5, Math.abs(y(candle.open) - y(candle.close)));
            const volumeHeight = candle.volume / maxVolume * (volumeBottom - volumeTop);
            return <g key={candle.date}><title>{`${candle.date} O ${candle.open.toFixed(2)} H ${candle.high.toFixed(2)} L ${candle.low.toFixed(2)} C ${candle.close.toFixed(2)} V ${compact(candle.volume)}`}</title><line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="1.2" /><rect x={x(index) - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} rx="0.8" /><rect x={x(index) - candleWidth / 2} y={volumeBottom - volumeHeight} width={candleWidth} height={volumeHeight} fill={color} opacity="0.58" /></g>;
          })}
          <line x1={left} x2={plotRight} y1={volumeTop - 8} y2={volumeTop - 8} stroke="var(--chart-grid)" />
          <text x={left + 5} y={volumeTop + 5} fill="var(--chart-label)" fontSize="10" fontFamily="monospace">VOLUME</text>
          <path d={pathFor(ema8)} fill="none" stroke="var(--chart-ema-fast)" strokeWidth="1.8" />
          <path d={pathFor(ema21)} fill="none" stroke="var(--chart-ema-mid)" strokeWidth="1.6" />
          <path d={pathFor(ema50)} fill="none" stroke="var(--chart-ema-slow)" strokeWidth="1.5" />
          {[0, Math.floor(candles.length / 2), candles.length - 1].map((index) => <text key={index} x={x(index)} y={492} textAnchor="middle" fill="var(--chart-label)" fontSize="10" fontFamily="monospace">{candles[index].date.slice(5)}</text>)}
        </svg>
      </div>
      <div className="chart-legend flex flex-wrap gap-3 border-t p-3 font-mono text-[10px]"><span className="chart-fast">8 EMA</span><span className="chart-mid">21 EMA</span><span className="chart-slow">50 EMA</span><span className="text-muted-foreground">Chart loads for every researched ticker</span></div>
    </section>
  );
}

export function TickerResearchView() {
  const [ticker, setTicker] = useState("");
  const [result, setResult] = useState<TickerResearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = ticker.trim().toUpperCase();
    if (!normalized || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(
        `/api/research/${encodeURIComponent(normalized)}`,
        { cache: "no-store" },
      );
      const payload = await response.json() as ResearchResponse;
      if (!payload.ok) throw new Error(payload.error.message);
      setTicker(payload.data.ticker);
      setResult(payload.data);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Ticker research failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="panel p-5">
        <div className="mx-auto max-w-2xl">
          <label
            htmlFor="ticker-research"
            className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
          >
            US stock ticker
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id="ticker-research"
              value={ticker}
              onChange={(event) =>
                setTicker(event.target.value.toUpperCase().slice(0, 6))
              }
              placeholder="Example: NVDA"
              autoComplete="off"
              className="h-12 font-mono text-base uppercase"
            />
            <Button className="h-12 px-5" disabled={!ticker.trim() || busy}>
              {busy ? (
                <SpinnerGap className="animate-spin" />
              ) : (
                <MagnifyingGlass weight="bold" />
              )}
              {busy ? "Researching" : "Research ticker"}
            </Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Refreshes completed daily candles, sector context, and 21-60 DTE
            near-the-money options without rerunning the full market scan.
          </p>
        </div>
      </form>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <section className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-mono text-3xl font-semibold">
                    {result.ticker}
                  </h2>
                  {result.setup && (
                    <>
                      <ScoreBadge score={result.setup.finalScore} />
                      <StatusBadge label={result.setup.status} />
                    </>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.company}
                </p>
                <p className="mt-3 text-sm">{result.summary}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>Completed through {result.marketDate}</p>
                <p className="mt-1">Source: {result.provider}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Price"
                value={money(result.price)}
                detail={percent(result.change)}
              />
              <Metric
                label="Sector"
                value={result.sector}
                detail={`${result.sectorTicker} strength ${result.sectorStrength}`}
              />
              <Metric
                label="Industry / theme"
                value={result.theme}
              />
              <Metric
                label="Detected setup"
                value={result.setup?.setup ?? "No qualifying setup"}
                detail={
                  result.setup
                    ? `${result.setup.grade} grade / ${result.setup.finalScore} score`
                    : "Options are still evaluated below"
                }
              />
            </div>
          </section>

          <ResearchChart result={result} />

          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <ChartLine className="text-primary" weight="bold" />
              <h3 className="font-medium">Options tradability</h3>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Implied volatility"
                value={
                  result.optionIv == null
                    ? "Unavailable"
                    : `${result.optionIv.toFixed(1)}%`
                }
                detail={
                  result.optionExpiration
                    ? `${result.optionDte} DTE / ${result.optionExpiration}`
                    : undefined
                }
              />
              <Metric
                label="Median spread"
                value={
                  result.optionSpreadDollars == null
                    ? "Unavailable"
                    : money(result.optionSpreadDollars)
                }
                detail={
                  result.optionSpreadPct == null
                    ? undefined
                    : `${result.optionSpreadPct.toFixed(1)}% of midpoint`
                }
              />
              <Metric
                label="Open interest"
                value={
                  result.optionOpenInterest == null
                    ? "Unavailable"
                    : compact(result.optionOpenInterest)
                }
                detail={
                  result.optionVolume == null
                    ? undefined
                    : `${compact(result.optionVolume)} contract volume`
                }
              />
              <Metric
                label="Tradability score"
                value={
                  result.optionsTradabilityScore == null
                    ? "Unavailable"
                    : `${result.optionsTradabilityScore}/100`
                }
                detail={
                  result.optionsAvailable
                    ? "Included in the setup grade"
                    : "No usable chain returned"
                }
              />
            </div>
          </section>

          {result.setup && (
            <section className="panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-medium">Trigger and structure</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {result.setup.plan.trigger}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/setups/${result.ticker}`}>
                      Open full chart
                      <ArrowSquareOut />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/setup-coach?ticker=${result.ticker}`}>
                      Ask setup coach
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Metric
                  label="Horizontal breakout"
                  value={money(result.setup.plan.breakoutLevel)}
                />
                <Metric
                  label="Earlier trendline"
                  value={money(result.setup.plan.alternateTrigger)}
                />
                <Metric
                  label="Base tightening"
                  value={`${result.setup.plan.tighteningPercent.toFixed(0)}%`}
                  detail={`${result.setup.plan.baseDays} completed sessions`}
                />
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
