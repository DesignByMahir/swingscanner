import { readAccountFlags, writeAccountFlags } from "@/lib/account-flags-store";
import { readAccountSession } from "@/lib/local-account-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await readAccountSession(request);
  if (!session) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  return Response.json({ ok: true, data: await readAccountFlags(session.accountId) });
}

export async function PUT(request: Request) {
  const session = await readAccountSession(request);
  if (!session) return Response.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const body = await request.json() as { flags?: string[] };
  return Response.json({ ok: true, data: await writeAccountFlags(session.accountId, body.flags ?? []) });
}
