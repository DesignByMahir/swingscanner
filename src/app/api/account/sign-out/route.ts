import { clearAccountSessionCookie } from "@/lib/local-account-store";

export const runtime = "nodejs";

export async function POST() {
  return Response.json({ ok: true }, {
    headers: { "set-cookie": clearAccountSessionCookie() },
  });
}
