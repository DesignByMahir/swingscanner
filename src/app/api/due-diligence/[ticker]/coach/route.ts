import { z } from "zod";
import { researchDueDiligence } from "@/lib/due-diligence";
import { createLocalCoachStream } from "@/lib/local-coach";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(5000),
  })).max(30),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid due-diligence question." }, { status: 400 });
  }

  try {
    const report = await researchDueDiligence((await context.params).ticker);
    const system = `You are SwingScanner's local long-term due-diligence analyst.
Use only the supplied report evidence and help the user test the bull case rather than promote it.

Required behavior:
- Separate reported facts, consensus estimates, headline evidence, and interpretation.
- Evaluate financial quality, forward outlook, contracts/catalysts, sector strength, valuation, and risks.
- Explain unavailable evidence directly. Never fill a missing value with an assumption.
- Treat contract headlines as leads that require opening the linked source; do not invent contract values or terms.
- A headline title is not evidence for revenue, earnings, margins, forecasts, or valuation. Never say a headline supports a financial metric.
- You do not have article bodies. Do not infer what an article proves, call a publisher reputable, or summarize content beyond the supplied title.
- Prioritize the report's quantified financial and outlook metrics when asked for the strongest evidence.
- For ETFs and indices, explain that company profitability metrics are not applicable.
- Challenge weak claims and identify what the user should verify in filings, earnings calls, and source articles.
- Do not give personalized buy/sell instructions, certainty, allocation advice, or price predictions.
- Keep answers concise, structured, and candid.

Due-diligence report:
${JSON.stringify(report)}`;
    const { model, stream } = await createLocalCoachStream(
      system,
      parsed.data.messages,
      request.signal,
    );
    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-due-diligence-provider": "local-ollama",
        "x-due-diligence-model": model,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The local due-diligence coach is unavailable." },
      { status: 503 },
    );
  }
}
