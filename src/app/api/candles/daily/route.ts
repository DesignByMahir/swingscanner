import { type NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { ProviderRouter } from "@/lib/data/provider-router";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase();
  if (!symbol || !/^[A-Z.-]{1,8}$/.test(symbol)) return fail("INVALID_SYMBOL", "Provide a valid symbol.", 400);
  const router = new ProviderRouter({ enableYahooFallback: true, dailyCacheHours: 20 });
  const result = await router.getDaily(symbol, 250);
  return result.candles ? ok(result.candles, { symbol, provider: result.provider, cacheHit: result.cacheHit }) : fail("NO_DATA", "No daily candles were available.", 502);
}
