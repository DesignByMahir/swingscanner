import { ok } from "@/lib/api";
import { withCache } from "@/lib/data/cache";
import { getNasdaqUniverse } from "@/lib/data/providers/nasdaq-universe-provider";

export async function GET() {
  const result = await withCache("universe:nasdaqtrader", 24 * 60 * 60 * 1000, getNasdaqUniverse);
  return ok(result.value, { provider: "nasdaqtrader", cacheHit: result.hit, count: result.value.length });
}
