import { fail, ok } from "@/lib/api";
import { researchDueDiligence } from "@/lib/due-diligence";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(
  _: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  try {
    return ok(await researchDueDiligence((await context.params).ticker));
  } catch (error) {
    return fail(
      "DUE_DILIGENCE_FAILED",
      error instanceof Error ? error.message : "Due-diligence research failed.",
      422,
    );
  }
}
