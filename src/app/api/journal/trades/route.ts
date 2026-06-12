import { journalTradesSchema, readJournal, writeJournal } from "@/lib/journal-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  void request;
  return Response.json({ ok: true, data: await readJournal(), storage: "device-local-file" });
}

export async function PUT(request: Request) {
  const parsed = journalTradesSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid journal data." }, { status: 400 });
  await writeJournal(parsed.data);
  return Response.json({ ok: true, count: parsed.data.length, storage: "device-local-file" });
}
