"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Play, WarningCircle } from "@phosphor-icons/react";
import type { FreeScanResult } from "@/types/domain";
import { Metric, StatusBadge } from "@/components/shared";
import { ScannerTable } from "@/components/scanner-table";
import { Button } from "@/components/ui/button";

export function ScannerDashboard() {
  const [scan, setScan] = useState<FreeScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/scan/latest", { cache: "no-store" });
      const payload = await response.json() as { ok: boolean; data?: FreeScanResult; error?: { message: string } };
      if (!payload.ok || !payload.data) throw new Error(payload.error?.message ?? "No live scan is available yet.");
      setScan(payload.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No live scan is available yet.");
    } finally {
      setLoading(false);
    }
  }, []);

  const runLiveScan = async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/scan/free-daily", { method: "POST" });
      const payload = await response.json() as { ok: boolean; data?: FreeScanResult; error?: { message: string } };
      if (!payload.ok || !payload.data) throw new Error(payload.error?.message ?? "The live scan failed.");
      setScan(payload.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The live scan failed.");
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(loadLatest, 0);
    return () => window.clearTimeout(timer);
  }, [loadLatest]);

  return (
    <>
      <div className="scan-status-panel mb-4 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/6 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Database size={18} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label="Live Free EOD" />
              {scan && <span className="font-mono text-xs text-muted-foreground">Market date {scan.marketDate}</span>}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Completed daily and aggregated weekly candles are scored locally for relative strength, theme leadership, 8-week EMA structure, entry quality, and tradability.
              {scan?.optionsGate && ` Options liquidity influences the tradability score without deleting otherwise valid market leaders.`}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <Button className="scan-button scanner-scan-button" onClick={runLiveScan} disabled={running || loading}>
            <Play className={running ? "animate-pulse" : ""} weight="fill" /> {running ? "Scanning..." : "Scan"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex gap-3 rounded-lg border border-warning/25 bg-warning/8 p-4 text-sm text-warning">
          <WarningCircle size={18} className="shrink-0" />
          <p>{error} Run a live scan to create the first local result.</p>
        </div>
      )}

      <div className="scanner-metrics mb-5 panel overflow-hidden">
        <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <Metric label="Universe scanned" value={(scan?.scannedCount ?? 0).toLocaleString()} detail={scan ? `${scan.universeCount.toLocaleString()} clean NasdaqTrader symbols` : "Waiting for a live scan"} />
          <Metric label="Leader candidates" value={`${scan?.passedBaseFilters ?? 0}`} detail="Liquid names with measurable leadership, weekly structure, or a tradable reset" />
          <Metric label="Preferred options" value={`${scan?.optionsEligibleCount ?? 0}`} detail={scan ? `${scan.optionsRejectedCount ?? 0} shown with weaker liquidity` : "Tradability influences rank instead of deleting charts"} positive={Boolean(scan?.optionsEligibleCount)} />
          <Metric label="Provider failures" value={`${scan?.failedCount ?? 0}`} detail={scan ? `${scan.providerStats.cacheHits} cache hits` : "No scan loaded"} positive={Boolean(scan && scan.failedCount === 0)} />
        </div>
      </div>

      {scan && (
        <div className="scan-metadata mb-4 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>Scanned {new Date(scan.scanTimestamp).toLocaleString()}</span>
          <span>Daily: {scan.providerStats.dailyPrimary} to {scan.providerStats.dailyFallback ?? "none"}</span>
          <span>{(scan.durationMs / 1000).toFixed(1)}s</span>
          {scan.providerStats.warnings.map((warning) => <span key={warning} className="text-warning">{warning}</span>)}
        </div>
      )}

      {scan ? (
        <>
          {!!scan.sectorLeadership?.length && (
            <div className="panel mb-4 grid overflow-hidden sm:grid-cols-2 xl:grid-cols-6">
              {scan.sectorLeadership.slice(0, 6).map((sector) => (
                <div key={sector.ticker} className="border-b border-r p-4 last:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0">
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-primary">
                    #{sector.rank} {sector.ticker}
                  </p>
                  <p className="mt-2 text-sm font-medium">{sector.sector}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Strength {sector.score} | {sector.relative20d >= 0 ? "+" : ""}{sector.relative20d.toFixed(1)}% vs SPY
                  </p>
                </div>
              ))}
            </div>
          )}
          <ScannerTable
            setups={scan.topSetups}
            sectorLeadership={scan.sectorLeadership}
          />
        </>
      ) : (
        <div className="panel grid min-h-72 place-items-center p-8 text-center">
          <div>
            <Database className="mx-auto text-muted-foreground" size={28} />
            <p className="mt-4 font-medium">No local scan loaded</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Run the live scan once. Future launches will load the cached result from D:.</p>
            <Button className="scan-button scanner-scan-button mt-5" onClick={runLiveScan} disabled={running}><Play weight="fill" /> Scan</Button>
          </div>
        </div>
      )}
    </>
  );
}
