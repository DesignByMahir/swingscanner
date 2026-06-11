import { runFreeDailyScan } from "../src/lib/scan/run-free-daily-scan";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const maxUniverseSize = Number(process.env.SCAN_MAX_UNIVERSE ?? 5_000);
  console.log(`Starting Free EOD scan for up to ${maxUniverseSize} symbols...`);
  const result = await runFreeDailyScan({
    rules: {
      maxUniverseSize,
      enableYahooFallback: process.env.ENABLE_YAHOO_FALLBACK !== "false",
    },
  });
  console.log(JSON.stringify({
    scanTimestamp: result.scanTimestamp,
    marketDate: result.marketDate,
    durationSeconds: Number((result.durationMs / 1000).toFixed(1)),
    universeCount: result.universeCount,
    scannedCount: result.scannedCount,
    passedBaseFilters: result.passedBaseFilters,
    failedCount: result.failedCount,
    providerStats: result.providerStats,
  }, null, 2));
  console.table(result.topSetups.slice(0, 10).map((stock) => ({
    rank: stock.rank,
    ticker: stock.ticker,
    setup: stock.setup,
    score: stock.finalScore,
    price: stock.price,
    adr: stock.adr,
    rs: stock.rs,
    extension: stock.extension,
  })));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
