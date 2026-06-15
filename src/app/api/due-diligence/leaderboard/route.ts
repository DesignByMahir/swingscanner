import { fail, ok } from "@/lib/api";
import { getDueDiligenceLeaderboard } from "@/lib/due-diligence-leaderboard";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    return ok(await getDueDiligenceLeaderboard());
  } catch (error) {
    return fail(
      "DUE_DILIGENCE_LEADERBOARD_FAILED",
      error instanceof Error ? error.message : "The due-diligence leaderboard could not be refreshed.",
      503,
    );
  }
}
