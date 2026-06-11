import { fail, ok } from "@/lib/api";
import { researchSingleTicker } from "@/lib/research-single-ticker";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(
  _: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const ticker = (await context.params).ticker;
  try {
    return ok(await researchSingleTicker(ticker));
  } catch (error) {
    return fail(
      "TICKER_RESEARCH_FAILED",
      error instanceof Error ? error.message : "Ticker research failed.",
      422,
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  return GET(request, context);
}
