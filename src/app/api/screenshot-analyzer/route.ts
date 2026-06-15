import { z } from "zod";
import { createLocalVisionCoachStream } from "@/lib/local-coach";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({
  image: z.string().max(9_000_000),
  notes: z.string().max(3000).optional().default(""),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Upload a valid chart screenshot under 8 MB." }, { status: 400 });
  }
  const match = parsed.data.image.match(/^data:image\/(?:png|jpeg|webp);base64,(.+)$/);
  if (!match) {
    return Response.json({ error: "The uploaded file must be a PNG, JPEG, or WebP image." }, { status: 400 });
  }
  const system = `You are SwingScanner's local chart screenshot analyst.
Analyze only visible evidence in the supplied TradingView screenshot.

Required structure:
1. Visible trend and timeframe, if legible.
2. Pattern or base structure.
3. Horizontal resistance and support areas.
4. Descending trendline, if one is visibly valid.
5. Volume behavior.
6. Possible breakout trigger and invalidation area.
7. What is missing or unreadable.

Rules:
- Do not invent prices, indicators, ticker symbols, dates, news, fundamentals, or options data.
- If a label or level is not legible, say so.
- Treat drawings already visible on the screenshot as the user's annotations, not objective facts.
- Do not give personalized buy/sell instructions or position sizing.
- Be concise and use price levels only when clearly readable.`;
  const prompt = parsed.data.notes.trim()
    ? `Analyze this chart. User context: ${parsed.data.notes}`
    : "Analyze this chart screenshot and test whether it shows a clean swing setup.";
  try {
    const { model, stream } = await createLocalVisionCoachStream(
      system,
      prompt,
      match[1],
      request.signal,
    );
    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-screenshot-model": model,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "The local screenshot analyst is unavailable." },
      { status: 503 },
    );
  }
}
