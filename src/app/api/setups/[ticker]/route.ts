import { fail, ok } from "@/lib/api";
import { getSetupDetail } from "@/lib/setup-detail";

export async function GET(_: Request, context: { params: Promise<{ ticker: string }> }) {
  const ticker = (await context.params).ticker.toUpperCase();
  if (!/^[A-Z.-]{1,8}$/.test(ticker)) return fail("INVALID_SYMBOL", "Provide a valid symbol.", 400);
  const detail = await getSetupDetail(ticker);
  return detail ? ok(detail) : fail("SETUP_NOT_FOUND", "This ticker is not in the latest ranked scan.", 404);
}
