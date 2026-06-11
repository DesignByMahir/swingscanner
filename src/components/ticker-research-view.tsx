"use client";

import {
  ArrowSquareOut,
  ChartLine,
  MagnifyingGlass,
  SpinnerGap,
} from "@phosphor-icons/react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { ScoreBadge, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compact, money, percent } from "@/lib/format";
import type { TickerResearchResult } from "@/types/domain";

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

