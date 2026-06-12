import { fail, ok } from "@/lib/api";
import { getCached } from "@/lib/data/cache";
import { normalizeScanResult } from "@/lib/scan/normalize-scan";
import type { FreeScanResult } from "@/types/domain";

export async function GET() {
  const result = await getCached<FreeScanResult>("scan:free-eod:latest", true);
  return result ? ok(normalizeScanResult(result.value), { cacheHit: true, stale: result.stale }) : fail("NO_SCAN", "No free EOD scan has completed yet.", 404);
}
