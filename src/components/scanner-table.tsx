"use client";

import { useMemo, useState } from "react";
import { CaretDown, CaretUp, DownloadSimple, Funnel, MagnifyingGlass, Star } from "@phosphor-icons/react";
import Link from "next/link";
import type { StockSetup } from "@/types/domain";
import { compact, money, percent } from "@/lib/format";
import { ScoreBadge, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSwingAccount } from "@/components/account-provider";

type SortKey = "rank" | "ticker" | "setup" | "sector" | "options" | "price" | "adr" | "relativeVolume" | "rs" | "emaDistance" | "extension" | "tightening" | "score" | "status";
type SortDirection = "desc" | "asc";

const statusOrder: Record<StockSetup["status"], number> = {
  Actionable: 4,
  "Watch only": 3,
  "Blocked by market": 2,
  Rejected: 1,
};

function sortValue(stock: StockSetup, key: SortKey): string | number | null {
  switch (key) {
    case "rank": return stock.rank;
    case "ticker": return stock.ticker;
    case "setup": return stock.setup;
    case "sector": return `${stock.sector} ${stock.theme}`;
    case "options": return stock.optionsTradabilityScore;
    case "price": return stock.price;
    case "adr": return stock.adr;
    case "relativeVolume": return stock.relativeVolume;
    case "rs": return stock.rs;
    case "emaDistance": return stock.distance8;
    case "extension": return stock.extensionRisk;
    case "tightening": return stock.tighteningPercent ?? stock.plan.tighteningPercent ?? 0;
    case "score": return stock.finalScore;
    case "status": return statusOrder[stock.status];
  }
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; direction: SortDirection } | null;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className={className} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1.5 whitespace-nowrap py-3.5 text-left hover:text-foreground" title={`Sort by ${label}`}>
        {label}
        <span className={active ? "text-primary" : "text-muted-foreground/35"}>
          {active && sort.direction === "asc" ? <CaretUp size={11} weight="bold" /> : <CaretDown size={11} weight="bold" />}
        </span>
      </button>
    </th>
  );
}

export function ScannerTable({ setups }: { setups: StockSetup[] }) {
  const account = useSwingAccount();
  const [localFlags, setLocalFlags] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("swingscanner-flagged-tickers") ?? "[]"); } catch { return []; }
  });
  const [query, setQuery] = useState("");
  const [setup, setSetup] = useState("all");
  const [extension, setExtension] = useState("all");
  const [sector, setSector] = useState("all");
  const [optionsQuality, setOptionsQuality] = useState("all");
  const [maxSpread, setMaxSpread] = useState("all");
  const [ivBand, setIvBand] = useState("all");
  const [showRejected, setShowRejected] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  const flagged = account.userId ? account.cloud.flaggedTickers : localFlags;
  const toggleFlag = (ticker: string) => {
    if (account.userId) {
      void account.toggleFlag(ticker);
      return;
    }
    const next = localFlags.includes(ticker) ? localFlags.filter((item) => item !== ticker) : [...localFlags, ticker];
    setLocalFlags(next);
    localStorage.setItem("swingscanner-flagged-tickers", JSON.stringify(next));
  };

  const filtered = useMemo(
    () =>
      setups.filter((stock) => {
        if (!showRejected && stock.status === "Rejected") return false;
        if (query && !`${stock.ticker} ${stock.company}`.toLowerCase().includes(query.toLowerCase())) return false;
        if (setup !== "all" && stock.setup !== setup) return false;
        if (extension !== "all" && stock.extension !== extension) return false;
        if (sector !== "all" && stock.sector !== sector) return false;
        if (optionsQuality === "available" && !stock.optionsAvailable) return false;
        if (optionsQuality === "tradable" && (stock.optionsTradabilityScore ?? -1) < 60) return false;
        if (optionsQuality === "excellent" && (stock.optionsTradabilityScore ?? -1) < 75) return false;
        if (maxSpread !== "all" && (stock.optionSpreadPct == null || stock.optionSpreadPct > Number(maxSpread))) return false;
        if (ivBand === "under-50" && (stock.optionIv == null || stock.optionIv >= 50)) return false;
        if (ivBand === "50-100" && (stock.optionIv == null || stock.optionIv < 50 || stock.optionIv > 100)) return false;
        if (ivBand === "over-100" && (stock.optionIv == null || stock.optionIv <= 100)) return false;
        return true;
      }),
    [setups, showRejected, query, setup, extension, sector, optionsQuality, maxSpread, ivBand],
  );

  const visible = useMemo(() => {
    if (!sort) return filtered;
    return [...filtered].sort((left, right) => {
      const leftValue = sortValue(left, sort.key);
      const rightValue = sortValue(right, sort.key);
      if (leftValue == null && rightValue == null) return left.rank - right.rank;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      const comparison = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
      return (sort.direction === "asc" ? comparison : -comparison) || left.rank - right.rank;
    });
  }, [filtered, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "desc" };
      if (current.direction === "desc") return { key, direction: "asc" };
      return null;
    });
  };

  const exportCsv = () => {
    const headers = ["Ticker", "Company", "Sector", "Industry/theme", "Option IV", "Option spread dollars", "Option spread percent", "Options score", "Setup", "Score", "Extension", "Optimal breakout", "Trendline trigger", "Base tightening", "Base low", "Target 1", "Stop rule"];
    const rows = visible.map((stock) => [stock.ticker, stock.company, stock.sector, stock.theme, stock.optionIv ?? "Unavailable", stock.optionSpreadDollars ?? "Unavailable", stock.optionSpreadPct ?? "Unavailable", stock.optionsTradabilityScore ?? "Unavailable", stock.setup, stock.finalScore, stock.extension, stock.plan.breakoutLevel ?? stock.plan.entryLow, stock.plan.alternateTrigger ?? stock.plan.entryLow, stock.tighteningPercent ?? stock.plan.tighteningPercent ?? "Unavailable", stock.plan.baseLow ?? "Unavailable", stock.plan.target1, stock.plan.stopRule ?? "Use breakout day's low"]);
    const csv = [headers, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `swingscanner-live-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="panel mb-4 p-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_190px_190px_190px_auto_auto]">
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-2.5 text-muted-foreground" size={17} />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter live ticker or company" className="h-9 pl-9" />
          </div>
          <Select value={setup} onValueChange={setSetup}>
            <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Setup type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All setup types</SelectItem>
              {[...new Set(setups.map((stock) => stock.setup))].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={extension} onValueChange={setExtension}>
            <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Extension" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All extension states</SelectItem>
              {["Clean", "Slightly Extended", "Very Extended", "Avoid / Chasing"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Sector" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sectors</SelectItem>
              {[...new Set(setups.map((stock) => stock.sector))].sort().map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex h-9 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-xs text-muted-foreground">
            <Switch checked={showRejected} onCheckedChange={setShowRejected} /> Rejected
          </label>
          <Button variant="outline" size="sm" onClick={exportCsv}><DownloadSimple /> Export</Button>
        </div>
        <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-[190px_190px_190px_auto]">
          <Select value={optionsQuality} onValueChange={setOptionsQuality}>
            <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Options quality" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All options states</SelectItem>
              <SelectItem value="available">Options available</SelectItem>
              <SelectItem value="tradable">Tradability 60+</SelectItem>
              <SelectItem value="excellent">Tradability 75+</SelectItem>
            </SelectContent>
          </Select>
          <Select value={maxSpread} onValueChange={setMaxSpread}>
            <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Maximum spread" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any option spread</SelectItem>
              <SelectItem value="10">Spread 10% or less</SelectItem>
              <SelectItem value="20">Spread 20% or less</SelectItem>
              <SelectItem value="35">Spread 35% or less</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ivBand} onValueChange={setIvBand}>
            <SelectTrigger className="h-9 w-full"><SelectValue placeholder="IV band" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any implied volatility</SelectItem>
              <SelectItem value="under-50">IV below 50%</SelectItem>
              <SelectItem value="50-100">IV 50% to 100%</SelectItem>
              <SelectItem value="over-100">IV above 100%</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => { setOptionsQuality("all"); setMaxSpread("all"); setIvBand("all"); }} className="justify-self-start lg:justify-self-end">Clear confluence</Button>
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="scanner-results-table w-full min-w-[1900px] table-fixed text-left text-sm">
          <thead className="sticky top-0 z-[1] border-b bg-background text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <SortHeader label="Rank" sortKey="rank" sort={sort} onSort={toggleSort} className="px-4" />
              <SortHeader label="Ticker" sortKey="ticker" sort={sort} onSort={toggleSort} />
              <SortHeader label="Setup" sortKey="setup" sort={sort} onSort={toggleSort} />
              <SortHeader label="Sector / theme" sortKey="sector" sort={sort} onSort={toggleSort} />
              <SortHeader label="Options" sortKey="options" sort={sort} onSort={toggleSort} />
              <SortHeader label="Price" sortKey="price" sort={sort} onSort={toggleSort} />
              <SortHeader label="ADR" sortKey="adr" sort={sort} onSort={toggleSort} />
              <SortHeader label="Rel vol" sortKey="relativeVolume" sort={sort} onSort={toggleSort} />
              <SortHeader label="RS" sortKey="rs" sort={sort} onSort={toggleSort} />
              <SortHeader label="EMA distance" sortKey="emaDistance" sort={sort} onSort={toggleSort} />
              <SortHeader label="Extension" sortKey="extension" sort={sort} onSort={toggleSort} />
              <SortHeader label="Tightening" sortKey="tightening" sort={sort} onSort={toggleSort} />
              <SortHeader label="Score" sortKey="score" sort={sort} onSort={toggleSort} />
              <SortHeader label="Status" sortKey="status" sort={sort} onSort={toggleSort} className="px-4" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((stock) => (
              <tr key={stock.ticker} className="hover:bg-secondary/35">
                <td className="metric-number px-5 py-4 text-muted-foreground">{String(stock.rank).padStart(2, "0")}</td>
                <td>
                  <div className="flex items-center gap-2"><button type="button" onClick={() => toggleFlag(stock.ticker)} aria-label={`${flagged.includes(stock.ticker) ? "Unflag" : "Flag"} ${stock.ticker}`} className={flagged.includes(stock.ticker) ? "text-warning" : "text-muted-foreground/45 hover:text-warning"}><Star size={14} weight={flagged.includes(stock.ticker) ? "fill" : "regular"} /></button><Link href={`/setups/${encodeURIComponent(stock.ticker)}`} className="font-mono font-semibold hover:text-primary">{stock.ticker}</Link></div>
                  <p className="mt-1 max-w-36 truncate text-xs text-muted-foreground">{stock.company}</p>
                </td>
                <td><Link href={`/setups/${encodeURIComponent(stock.ticker)}`} className="max-w-36 hover:text-primary">{stock.setup}</Link><p className="mt-1 text-xs text-muted-foreground">{stock.matchedSetups.length} matches</p></td>
                <td><p>{stock.sector}</p><p className="mt-1 text-xs text-muted-foreground">{stock.theme}</p></td>
                <td>{stock.optionsAvailable ? <><p className="font-mono text-xs">IV {stock.optionIv?.toFixed(1)}% · Score {stock.optionsTradabilityScore}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">Spread {stock.optionSpreadPct?.toFixed(1)}% · OI {compact(stock.optionOpenInterest ?? 0)} · {stock.optionDte}D</p></> : <span className="text-xs text-muted-foreground">Unavailable</span>}</td>
                <td><p className="metric-number">{money(stock.price)}</p><p className={`mt-1 font-mono text-xs ${stock.change >= 0 ? "text-positive" : "text-negative"}`}>{percent(stock.change)}</p></td>
                <td className="metric-number">{stock.adr.toFixed(2)}%</td>
                <td><p className="metric-number">{stock.relativeVolume.toFixed(2)}x</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{compact(stock.avgVolume)} avg</p></td>
                <td className="metric-number">{stock.rs}</td>
                <td><p className="font-mono text-xs">8E {percent(stock.distance8)}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">21E {percent(stock.distance21)}</p></td>
                <td><StatusBadge label={stock.extension} /></td>
                <td className="metric-number">{(stock.tighteningPercent ?? stock.plan.tighteningPercent ?? 0).toFixed(0)}%</td>
                <td><ScoreBadge score={stock.finalScore} /></td>
                <td className="px-4"><StatusBadge label={stock.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="grid min-h-52 place-items-center p-8 text-center">
            <div><Funnel className="mx-auto text-muted-foreground" size={24} /><p className="mt-3 text-sm font-medium">No live setups match these filters</p><Button variant="link" onClick={() => { setQuery(""); setSetup("all"); setExtension("all"); setSector("all"); setOptionsQuality("all"); setMaxSpread("all"); setIvBand("all"); setShowRejected(false); }}>Clear filters</Button></div>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{visible.length} of {setups.length} live candidates from the latest completed scan.</p>
    </>
  );
}
