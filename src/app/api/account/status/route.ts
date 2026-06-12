import { readAccountFlags } from "@/lib/account-flags-store";
import { readAccountSession } from "@/lib/local-account-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await readAccountSession(request);
  if (!session) return Response.json({ ok: true, user: null, flaggedTickers: [] });
  return Response.json({
    ok: true,
    user: { id: session.accountId, username: session.username },
    flaggedTickers: await readAccountFlags(session.accountId),
  });
}
