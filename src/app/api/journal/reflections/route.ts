import { dailyReflectionsSchema, readDailyReflections, writeDailyReflections } from "@/lib/daily-reflection-store";
import { readAccountSession } from "@/lib/local-account-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await readAccountSession(request);
  return Response.json({ ok: true, data: await readDailyReflections(session?.accountId) });
}

export async function PUT(request: Request) {
  const parsed = dailyReflectionsSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid daily reflection data." }, { status: 400 });
  const session = await readAccountSession(request);
  await writeDailyReflections(parsed.data, session?.accountId);
  return Response.json({ ok: true, count: parsed.data.length });
}
