import { ok } from "@/lib/api";
import { runFreeDailyScan } from "@/lib/scan/run-free-daily-scan";

export const maxDuration = 300;

export async function POST() {
  const result = await runFreeDailyScan();
  return ok(result);
}

export async function GET() {
  return POST();
}
