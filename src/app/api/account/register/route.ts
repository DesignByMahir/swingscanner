import {
  accountSessionCookie,
  createAccountSession,
  createLocalAccount,
} from "@/lib/local-account-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: string; pin?: string };
    const account = await createLocalAccount(body.username ?? "", body.pin ?? "");
    const token = await createAccountSession(account);
    return Response.json({ ok: true, user: account }, {
      headers: { "set-cookie": accountSessionCookie(token) },
    });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Account creation failed." }, { status: 400 });
  }
}
