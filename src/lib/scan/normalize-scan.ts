import type {
  FreeScanResult,
  SectorLeadership,
  SetupLabel,
  SetupType,
  StockSetup,
} from "@/types/domain";

function finite(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeSetupType(value: unknown): SetupType {
  const setup = String(value ?? "");
  if (setup === "Breakout" || setup === "Wedge Pop" || setup === "Bull Flag") return "Breakout";
  if (setup === "8-Week EMA Bounce") return setup;
  if (setup === "8-Week EMA Reclaim") return setup;
  if (setup === "Undercut and Reclaim") return setup;
  if (setup === "Extended / Wait") return setup;
  if (setup.includes("Base") || setup.includes("Squeeze") || setup.includes("Consolidation")) return "Tight Base";
  return "Leader Pullback";
}

function normalizeSetupLabel(stock: Partial<StockSetup>, setup: SetupType): SetupLabel {
  if (stock.setupLabel) return stock.setupLabel;
  if (setup === "Breakout" && finite(stock.rs) >= 85) return "Market Leader Breakout";
  if (setup === "Breakout") return "Strong Theme Breakout";
  if (setup === "8-Week EMA Bounce") return "8-Week EMA Bounce";
  if (setup === "8-Week EMA Reclaim") return "8-Week EMA Reclaim";
  if (setup === "Extended / Wait") return "Extended Leader - Wait for Pullback";
  if (setup === "Leader Pullback") return "Leader Pullback Near 8W EMA";
  return "Low Quality Momentum";
}

function normalizeStock(stock: StockSetup): StockSetup {
  const setup = normalizeSetupType(stock.setup);
  const distanceWeek8 = finite(stock.distanceWeek8, finite(stock.distance21));
  const weekEma8 = finite(
    stock.weekEma8,
    finite(stock.price) / Math.max(1 + distanceWeek8 / 100, 0.01),
  );
  const weekEma21 = finite(
    stock.weekEma21,
    finite(stock.price) / Math.max(1 + finite(stock.distance50) / 100, 0.01),
  );
  const themeScore = finite(
    stock.themeScore,
    Math.max(5, Math.min(20, 15 - (stock.sectorRank ?? 6))),
  );

  return {
    ...stock,
    setup,
    setupLabel: normalizeSetupLabel(stock, setup),
    canonicalTheme: stock.canonicalTheme || stock.theme || stock.sector,
    relative5Spy: finite(stock.relative5Spy),
    relative5Qqq: finite(stock.relative5Qqq),
    relative20Spy: finite(stock.relative20Spy),
    relative20Qqq: finite(stock.relative20Qqq),
    relative63Spy: finite(stock.relative63Spy),
    relative63Qqq: finite(stock.relative63Qqq),
    weekEma8,
    weekEma21,
    distanceWeek8,
    weeklyTrendHealthy: stock.weeklyTrendHealthy ?? (
      finite(stock.price) >= weekEma8 &&
      weekEma8 >= weekEma21
    ),
    themeScore,
    peerStrengthCount: finite(stock.peerStrengthCount),
    scoreCap: finite(stock.scoreCap, 100),
    capReasons: Array.isArray(stock.capReasons) ? stock.capReasons : [],
    matchedSetups: Array.isArray(stock.matchedSetups)
      ? [...new Set(stock.matchedSetups.map(normalizeSetupType))]
      : [setup],
  };
}

function normalizeSector(sector: SectorLeadership): SectorLeadership {
  return {
    ...sector,
    change1d: finite(sector.change1d),
    change5d: finite(sector.change5d),
  };
}

export function normalizeScanResult(scan: FreeScanResult): FreeScanResult {
  return {
    ...scan,
    sectorLeadership: scan.sectorLeadership?.map(normalizeSector) ?? [],
    topSetups: scan.topSetups.map(normalizeStock),
    watchlist: scan.watchlist.map(normalizeStock),
  };
}
