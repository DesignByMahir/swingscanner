import { ok } from "@/lib/api";
import { getCached } from "@/lib/data/cache";
import type { FreeScanResult } from "@/types/domain";

export async function GET() {
  const latest = await getCached<FreeScanResult>("scan:free-eod:latest", true);
  return ok({
    configuredMode: "free-eod",
    stooq: { configured: true, note: "Primary provider; may return browser verification." },
    yahooFallback: { enabled: process.env.ENABLE_YAHOO_FALLBACK !== "false" },
    durableCache: { provider: "local-file", configured: true },
    latestScan: latest ? { timestamp: latest.value.scanTimestamp, marketDate: latest.value.marketDate, stale: latest.stale, scannedCount: latest.value.scannedCount, failedCount: latest.value.failedCount } : null,
  });
}
