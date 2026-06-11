import { resolveLocalCoachModel } from "@/lib/local-coach";

export async function GET() {
  try {
    const model = await resolveLocalCoachModel();
    return Response.json({ ok: true, model, runtime: "local-ollama" });
  } catch {
    return Response.json({ ok: false, model: null, runtime: "local-ollama" }, { status: 503 });
  }
}
