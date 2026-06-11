import { fail, ok } from "@/lib/api";
import { getMarketIntelligence } from "@/lib/data/market-intelligence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const forceRefresh = new URL(request.url).searchParams.get("refresh") === "1";
    const result = await getMarketIntelligence(forceRefresh);
    return ok(result.value, { cacheHit: result.cacheHit });
  } catch (error) {
    return fail(
      "MARKET_INTELLIGENCE_UNAVAILABLE",
      error instanceof Error ? error.message : "Sector performance and news are unavailable.",
      503,
    );
  }
}
