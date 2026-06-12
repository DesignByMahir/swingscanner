import { journalTradesSchema, readJournal, writeJournal } from "@/lib/journal-store";
import { readAccountSession } from "@/lib/local-account-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await readAccountSession(request);
  return Response.json({ ok: true, data: await readJournal(session?.accountId), storage: session ? "account-local-file" : "legacy-local-file" });
}

export async function PUT(request: Request) {
  const parsed = journalTradesSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid journal data." }, { status: 400 });
  const session = await readAccountSession(request);
  await writeJournal(parsed.data, session?.accountId);
  return Response.json({ ok: true, count: parsed.data.length, storage: session ? "account-local-file" : "legacy-local-file" });
}
