import { dailyReflectionsSchema, readDailyReflections, writeDailyReflections } from "@/lib/daily-reflection-store";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ ok: true, data: await readDailyReflections() });
}

export async function PUT(request: Request) {
  const parsed = dailyReflectionsSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid daily reflection data." }, { status: 400 });
  await writeDailyReflections(parsed.data);
  return Response.json({ ok: true, count: parsed.data.length });
}
