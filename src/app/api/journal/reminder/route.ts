import { readDailyReflections } from "@/lib/daily-reflection-store";
import { generateDailyReminder } from "@/lib/daily-reminder";
import { readJournal } from "@/lib/journal-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const recentHistory = new URL(request.url).searchParams.get("scope") === "recent";
  const [reflections, trades] = await Promise.all([readDailyReflections(), readJournal()]);
  return Response.json({ ok: true, data: generateDailyReminder(reflections, trades, recentHistory) });
}
