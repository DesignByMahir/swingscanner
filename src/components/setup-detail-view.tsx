"use client";

import {
  ArrowLeft,
  ArrowSquareOut,
  Brain,
  ChartLine,
  ShieldWarning,
  Target,
  TrendUp,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ScoreBadge, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { compact, money, percent } from "@/lib/format";
import type { SetupChartCandle, SetupDetail } from "@/lib/setup-detail";

type Timeframe = "daily" | "weekly";
type DrawingTool = "cursor" | "path" | "horizontal" | "trendline" | "risk" | "long" | "short";
type Point = { x: number; y: number };
type Drawing =
  | { id: string; tool: "path"; points: Point[] }
  | { id: string; tool: Exclude<DrawingTool, "cursor" | "path">; p1: Point; p2: Point };

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

function withEmas(candles: Omit<SetupChartCandle, "ema8" | "ema21" | "ema50">[]) {
  const closes = candles.map((candle) => candle.close);
  const ema8 = calculateEma(closes, 8);
  const ema21 = calculateEma(closes, 21);
  const ema50 = calculateEma(closes, 50);
  return candles.map((candle, index) => ({ ...candle, ema8: ema8[index], ema21: ema21[index], ema50: ema50[index] }));
}

function weeklyCandles(candles: SetupChartCandle[]) {
  const groups = new Map<string, SetupChartCandle[]>();
  for (const candle of candles) {
    const date = new Date(`${candle.date}T00:00:00Z`);
    const day = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
    const key = date.toISOString().slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), candle]);
  }
  const aggregated = [...groups.entries()].map(([date, bars]) => ({
    date,
    open: bars[0].open,
    high: Math.max(...bars.map((bar) => bar.high)),
    low: Math.min(...bars.map((bar) => bar.low)),
    close: bars.at(-1)!.close,
    volume: bars.reduce((sum, bar) => sum + bar.volume, 0),
  }));
  return withEmas(aggregated);
}

function closestIndex(candles: SetupChartCandle[], date?: string) {
  if (!date) return -1;
  const target = new Date(`${date}T00:00:00Z`).getTime();
  let best = -1;
  let distance = Number.POSITIVE_INFINITY;
  candles.forEach((candle, index) => {
    const next = Math.abs(new Date(`${candle.date}T00:00:00Z`).getTime() - target);
    if (next < distance) {
      best = index;
      distance = next;
    }
  });
  return best;
}

function SetupChart({ detail }: { detail: SetupDetail }) {
  const [timeframe, setTimeframe] = useState<Timeframe>("daily");
  const [tool, setTool] = useState<DrawingTool>("cursor");
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [active, setActive] = useState<Drawing | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const allCandles = useMemo(() => timeframe === "daily" ? detail.candles : weeklyCandles(detail.candles), [detail.candles, timeframe]);
  const candles = allCandles.slice(timeframe === "daily" ? -90 : -80);
  const storageKey = `swingscanner:drawings:${detail.setup.ticker}:${timeframe}`;
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
  const breakout = detail.setup.plan.breakoutLevel ?? detail.setup.plan.entryLow;
  const alternateTrigger = detail.setup.plan.alternateTrigger ?? detail.setup.plan.entryLow;
  const baseLow = detail.setup.plan.baseLow ?? Math.min(...candles.slice(-10).map((candle) => candle.low));
  const prices = candles.flatMap((candle) => [candle.low, candle.high, candle.ema8 ?? candle.close, candle.ema21 ?? candle.close, candle.ema50 ?? candle.close]);
  const planPrices = [breakout, alternateTrigger, baseLow, detail.setup.plan.target1].filter(Number.isFinite);
  const minPrice = Math.min(...prices, ...planPrices) * 0.985;
  const maxPrice = Math.max(...prices, ...planPrices) * 1.015;
  const maxVolume = Math.max(...candles.map((candle) => candle.volume));
  const x = (index: number) => left + (index + 0.5) * plotWidth / candles.length;
  const y = (price: number) => top + (maxPrice - price) / (maxPrice - minPrice) * (priceBottom - top);
  const candleWidth = Math.max(2, plotWidth / candles.length * 0.62);
  const pathFor = (key: "ema8" | "ema21" | "ema50") =>
    candles.map((candle, index) => candle[key] == null ? null : `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(candle[key]!).toFixed(1)}`).filter(Boolean).join(" ");
  const gridPrices = Array.from({ length: 6 }, (_, index) => minPrice + (maxPrice - minPrice) * index / 5);
  const levels = [
    { label: "Target 1", value: detail.setup.plan.target1, color: "var(--chart-target)" },
    { label: "Breakout", value: breakout, color: "var(--chart-breakout)" },
    { label: "Base low", value: baseLow, color: "var(--chart-base)" },
  ];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(storageKey);
        const parsed = saved ? JSON.parse(saved) as Array<Drawing | { id: string; tool: string; p1: Point; p2: Point }> : [];
        setDrawings(parsed.flatMap((drawing) => {
          if (drawing.tool === "line") return [{ ...drawing, tool: "trendline" as const }];
          if (drawing.tool === "ray") return [{ ...drawing, tool: "horizontal" as const }];
          if (["path", "horizontal", "trendline", "risk", "long", "short"].includes(drawing.tool)) return [drawing as Drawing];
          return [];
        }));
      } catch {
        setDrawings([]);
      }
      setActive(null);
      setCursor(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  const saveDrawings = (next: Drawing[]) => {
    setDrawings(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  };

  const pointFromEvent = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(left, Math.min(plotRight, (event.clientX - bounds.left) * width / bounds.width)),
      y: Math.max(top, Math.min(priceBottom, (event.clientY - bounds.top) * height / bounds.height)),
    };
  };

  const pointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (tool === "cursor") return;
    const point = pointFromEvent(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setActive(tool === "path"
      ? { id: crypto.randomUUID(), tool, points: [point] }
      : { id: crypto.randomUUID(), tool, p1: point, p2: point });
  };

  const pointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = pointFromEvent(event);
    setCursor(point);
    if (!active) return;
    if (active.tool === "path") {
      const previous = active.points.at(-1)!;
      if (Math.hypot(point.x - previous.x, point.y - previous.y) >= 2.5) {
        setActive({ ...active, points: [...active.points, point] });
      }
    } else {
      setActive({ ...active, p2: point });
    }
  };

  const pointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!active) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const valid = active.tool === "path"
      ? active.points.length > 1
      : active.tool === "horizontal" || Math.hypot(active.p2.x - active.p1.x, active.p2.y - active.p1.y) > 3;
    if (valid) saveDrawings([...drawings, active]);
    setActive(null);
  };

  const renderDrawing = (drawing: Drawing, preview = false) => {
    const stroke = preview ? "var(--primary)" : "var(--chart-drawing)";
    if (drawing.tool === "path") {
      return <polyline points={drawing.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={stroke} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" opacity={preview ? 0.75 : 1} />;
    }
    if (drawing.tool === "horizontal") {
      return <line x1={left} y1={drawing.p2.y} x2={plotRight} y2={drawing.p2.y} stroke={stroke} strokeWidth="2" />;
    }
    if (drawing.tool === "trendline") {
      return <line x1={drawing.p1.x} y1={drawing.p1.y} x2={drawing.p2.x} y2={drawing.p2.y} stroke={stroke} strokeWidth="2.3" />;
    }
    const entry = drawing.p1.y;
    const drag = drawing.p2.y;
    const target = drawing.tool === "long"
      ? entry - Math.abs(drag - entry)
      : drawing.tool === "short"
        ? entry + Math.abs(drag - entry)
        : Math.min(entry, drag);
    const stop = drawing.tool === "long"
      ? entry + Math.abs(drag - entry)
      : drawing.tool === "short"
        ? entry - Math.abs(drag - entry)
        : Math.max(entry, drag);
    const x1 = Math.min(drawing.p1.x, drawing.p2.x);
    const x2 = Math.max(drawing.p1.x, drawing.p2.x);
    const profitTop = Math.min(entry, target);
    const lossTop = Math.min(entry, stop);
    return (
      <g opacity={preview ? 0.72 : 0.94}>
        <rect x={x1} y={profitTop} width={Math.max(7, x2 - x1)} height={Math.max(1, Math.abs(entry - target))} fill="var(--positive)" opacity="0.2" />
        <rect x={x1} y={lossTop} width={Math.max(7, x2 - x1)} height={Math.max(1, Math.abs(stop - entry))} fill="var(--negative)" opacity="0.23" />
        <line x1={x1} y1={entry} x2={x2} y2={entry} stroke={stroke} strokeWidth="2" strokeDasharray="5 4" />
        <line x1={x1} y1={target} x2={x2} y2={target} stroke="var(--positive)" strokeWidth="2" />
        <line x1={x1} y1={stop} x2={x2} y2={stop} stroke="var(--negative)" strokeWidth="2" />
        <text x={x2 + 5} y={target + 4} fill="var(--positive)" fontSize="10" fontFamily="monospace">TP</text>
        <text x={x2 + 5} y={stop + 4} fill="var(--negative)" fontSize="10" fontFamily="monospace">SL</text>
      </g>
    );
  };

  const startIndex = closestIndex(candles, detail.setup.plan.trendlineStartDate);
  const endIndex = closestIndex(candles, detail.setup.plan.trendlineEndDate);
  const hasScannerTrendline =
    startIndex >= 0 &&
    endIndex >= 0 &&
    Number.isFinite(detail.setup.plan.trendlineStartPrice) &&
    Number.isFinite(detail.setup.plan.trendlineEndPrice) &&
    detail.setup.plan.trendlineStartPrice > detail.setup.plan.trendlineEndPrice;

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div><p className="text-sm font-medium">Completed {timeframe} chart</p><p className="mt-1 text-xs text-muted-foreground">{candles.length} candles through {detail.marketDate} with volume</p></div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={timeframe === "daily" ? "default" : "outline"} onClick={() => setTimeframe("daily")}>Daily</Button>
          <Button size="sm" variant={timeframe === "weekly" ? "default" : "outline"} onClick={() => setTimeframe("weekly")}>Weekly</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b bg-background/40 p-3">
        {([
          ["cursor", "Cursor"],
          ["path", "Path"],
          ["horizontal", "Horizontal line"],
          ["trendline", "Trend line"],
          ["risk", "Take profit / stop"],
          ["long", "Long position"],
          ["short", "Short position"],
        ] as Array<[DrawingTool, string]>).map(([value, label]) => (
          <Button key={value} size="sm" variant={tool === value ? "default" : "outline"} onClick={() => { setTool(value); setActive(null); }}>{label}</Button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">{active ? "Drag to preview, then release" : `${drawings.length} saved drawing${drawings.length === 1 ? "" : "s"}`}</span>
        <Button size="sm" variant="ghost" disabled={!drawings.length} onClick={() => saveDrawings(drawings.slice(0, -1))}>Undo</Button>
        <Button size="sm" variant="ghost" disabled={!drawings.length} onClick={() => saveDrawings([])}>Clear</Button>
      </div>
      <div className="overflow-x-auto p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className={`min-w-[760px] w-full touch-none select-none ${tool === "cursor" ? "" : "cursor-crosshair"}`}
          role="img"
          aria-label={`${detail.setup.ticker} ${timeframe} candlestick chart`}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerLeave={() => { setCursor(null); if (active) setActive(null); }}
        >
          <rect width={width} height={height} fill="var(--chart-bg)" rx="10" />
          {gridPrices.map((price) => <g key={price}><line x1={left} x2={plotRight} y1={y(price)} y2={y(price)} stroke="var(--chart-grid)" strokeDasharray="3 5" /><text x={plotRight + 8} y={y(price) + 4} fill="var(--chart-label)" fontSize="11" fontFamily="monospace">{price.toFixed(2)}</text></g>)}
          {levels.map((level) => <g key={level.label}><line x1={left} x2={plotRight} y1={y(level.value)} y2={y(level.value)} stroke={level.color} strokeDasharray="6 5" opacity="0.72" /><text x={left + 6} y={y(level.value) - 5} fill={level.color} fontSize="10" fontFamily="monospace">{level.label} {level.value.toFixed(2)}</text></g>)}
          {hasScannerTrendline && <g><line x1={x(startIndex)} y1={y(detail.setup.plan.trendlineStartPrice)} x2={x(endIndex)} y2={y(detail.setup.plan.trendlineEndPrice)} stroke="var(--chart-trendline)" strokeWidth="2" strokeDasharray="5 4" /><text x={x(endIndex) - 4} y={y(detail.setup.plan.trendlineEndPrice) - 7} textAnchor="end" fill="var(--chart-trendline)" fontSize="10" fontFamily="monospace">Scanner trendline {alternateTrigger.toFixed(2)}</text></g>}
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
          <path d={pathFor("ema8")} fill="none" stroke="var(--chart-ema-fast)" strokeWidth="1.8" />
          <path d={pathFor("ema21")} fill="none" stroke="var(--chart-ema-mid)" strokeWidth="1.6" />
          <path d={pathFor("ema50")} fill="none" stroke="var(--chart-ema-slow)" strokeWidth="1.5" />
          {drawings.map((item) => <g key={item.id}>{renderDrawing(item)}</g>)}
          {active && renderDrawing(active, true)}
          {cursor && tool !== "cursor" && (
            <g pointerEvents="none" opacity="0.72">
              <line x1={left} y1={cursor.y} x2={plotRight} y2={cursor.y} stroke="var(--chart-drawing)" strokeWidth="1" strokeDasharray="3 5" />
              <line x1={cursor.x} y1={top} x2={cursor.x} y2={priceBottom} stroke="var(--chart-drawing)" strokeWidth="1" strokeDasharray="3 5" />
              <line x1={cursor.x - 8} y1={cursor.y} x2={cursor.x + 8} y2={cursor.y} stroke="var(--chart-drawing)" strokeWidth="2" />
              <line x1={cursor.x} y1={cursor.y - 8} x2={cursor.x} y2={cursor.y + 8} stroke="var(--chart-drawing)" strokeWidth="2" />
              <rect x={plotRight + 3} y={cursor.y - 10} width={69} height={19} rx={4} fill="var(--chart-drawing)" />
              <text x={plotRight + 37} y={cursor.y + 4} textAnchor="middle" fill="var(--chart-bg)" fontSize="10" fontFamily="monospace">
                {(maxPrice - ((cursor.y - top) / (priceBottom - top)) * (maxPrice - minPrice)).toFixed(2)}
              </text>
            </g>
          )}
          {[0, Math.floor(candles.length / 2), candles.length - 1].map((index) => <text key={index} x={x(index)} y={492} textAnchor="middle" fill="var(--chart-label)" fontSize="10" fontFamily="monospace">{candles[index].date.slice(5)}</text>)}
        </svg>
      </div>
      <div className="chart-legend flex flex-wrap gap-3 border-t p-3 font-mono text-[10px]"><span className="chart-fast">8 EMA</span><span className="chart-mid">21 EMA</span><span className="chart-slow">50 EMA</span><span className="chart-trendline">Scanner resistance</span><span className="text-muted-foreground">Press, drag, and release. Manual drawings save locally.</span></div>
    </div>
  );
}

export function SetupDetailView({ detail }: { detail: SetupDetail }) {
  const stock = detail.setup;
  const breakout = stock.plan.breakoutLevel ?? stock.plan.entryLow;
  const strongestParts = useMemo(() => [...stock.scoreParts].sort((a, b) => b.value - a.value).slice(0, 4), [stock.scoreParts]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm"><Link href="/scanner"><ArrowLeft /> Back to scanner</Link></Button>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Scan {new Date(detail.scanTimestamp).toLocaleString()}</p>
      </div>
      <div className="panel p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3"><h1 className="font-mono text-3xl font-semibold">{stock.ticker}</h1><StatusBadge label={stock.setup} /><StatusBadge label={stock.setupLabel} /><StatusBadge label={stock.extension} /><ScoreBadge score={stock.finalScore} /></div>
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"><a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(stock.ticker)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-primary">{stock.company} <ArrowSquareOut size={13} /></a><span>| {stock.sector} | {stock.canonicalTheme} | {stock.theme}</span></p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-sm"><span>{money(stock.price)}</span><span className={stock.change >= 0 ? "text-positive" : "text-negative"}>{percent(stock.change)}</span><span>RS {stock.rs}</span><span>5D vs QQQ {percent(stock.relative5Qqq)}</span><span>20D vs QQQ {percent(stock.relative20Qqq)}</span><span>8W {percent(stock.distanceWeek8)}</span><span>ADR {stock.adr.toFixed(2)}%</span><span>Rel vol {stock.relativeVolume.toFixed(2)}x</span><span>Options {stock.optionsAvailable ? `${stock.optionIv}% IV / $${stock.optionSpreadDollars} spread / ${stock.optionsTradabilityScore} score` : "N/A"}</span></div>
          </div>
          <div className="grid min-w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[560px]">
            <div className="rounded-lg border bg-background/60 p-3"><p className="text-[9px] uppercase text-muted-foreground">Primary pivot</p><p className="metric-number mt-2">{breakout.toFixed(2)}</p></div>
            <div className="rounded-lg border bg-background/60 p-3"><p className="text-[9px] uppercase text-muted-foreground">8-week EMA</p><p className="metric-number mt-2 text-warning">{stock.weekEma8.toFixed(2)}</p></div>
            <div className="rounded-lg border bg-background/60 p-3"><p className="text-[9px] uppercase text-muted-foreground">Theme score</p><p className="metric-number mt-2 text-positive">{stock.themeScore.toFixed(1)} / 20</p></div>
            <div className="rounded-lg border bg-background/60 p-3"><p className="text-[9px] uppercase text-muted-foreground">Target 1</p><p className="metric-number mt-2 text-positive">{stock.plan.target1.toFixed(2)}</p></div>
          </div>
        </div>
      </div>
      <SetupChart detail={detail} />
      <div className="grid gap-6"><div className="space-y-6">
        <div className="panel p-5">
          <div className="flex items-center gap-2 text-primary"><Target weight="fill" /><h2 className="font-medium">Daily / weekly trigger plan</h2></div>
          <p className="mt-4 text-lg leading-7">{stock.plan.trigger}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4"><p className="text-[10px] uppercase text-muted-foreground">Confirmation</p><p className="mt-2 text-sm leading-6">{stock.plan.confirmation}</p></div>
            <div className="rounded-lg border p-4"><p className="text-[10px] uppercase text-muted-foreground">Timeframe</p><p className="mt-2 text-sm leading-6">{stock.plan.timeframe}</p></div>
            <div className="rounded-lg border border-negative/25 p-4"><p className="flex items-center gap-2 text-[10px] uppercase text-negative"><ShieldWarning /> Stop rule</p><p className="mt-2 text-sm leading-6">{stock.plan.stopRule ?? "After entry, use the breakout day's low as the stop reference"}</p></div>
            <div className="rounded-lg border border-warning/25 p-4"><p className="text-[10px] uppercase text-warning">Avoid</p><p className="mt-2 text-sm leading-6">{stock.plan.avoid}</p></div>
          </div>
        </div>
        <div className="panel p-5"><div className="flex items-center gap-2 text-primary"><TrendUp weight="fill" /><h2 className="font-medium">Scanner thesis</h2></div><div className="mt-4 space-y-3">{detail.thesis.map((item) => <p key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{item}</p>)}</div>{!!stock.warnings.length && <div className="mt-5 rounded-lg border border-warning/25 bg-warning/8 p-4"><p className="text-xs font-medium text-warning">Data limitations</p>{stock.warnings.map((warning) => <p key={warning} className="mt-2 text-xs leading-5 text-muted-foreground">{warning}</p>)}</div>}</div>
        <div className="panel p-5"><div className="flex items-center gap-2"><ChartLine className="text-primary" /><h2 className="font-medium">Score evidence</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{strongestParts.map((part) => <div key={part.label} className="rounded-lg border p-3"><div className="flex justify-between text-xs"><span>{part.label}</span><span className="metric-number text-primary">{Math.round(part.value)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{ width: `${Math.min(100, part.value)}%` }} /></div></div>)}</div></div>
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-5"><div><div className="flex items-center gap-2"><Brain className="text-primary" weight="fill" /><h2 className="font-medium">Questions about this setup?</h2></div><p className="mt-2 text-sm text-muted-foreground">Open the shared local coach with {stock.ticker} selected.</p></div><Button asChild><Link href={`/setup-coach?ticker=${encodeURIComponent(stock.ticker)}`}><Brain /> Ask Setup Coach</Link></Button></div>
      </div></div>
    </div>
  );
}
