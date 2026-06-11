import { fail, ok } from "@/lib/api";
import { getCached } from "@/lib/data/cache";
import type { FreeScanResult } from "@/types/domain";

export async function GET() {
  const result = await getCached<FreeScanResult>("scan:free-eod:latest", true);
  return result ? ok(result.value, { cacheHit: true, stale: result.stale }) : fail("NO_SCAN", "No free EOD scan has completed yet.", 404);
}
