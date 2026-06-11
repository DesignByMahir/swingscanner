import { z } from "zod";
import { readJournal } from "@/lib/journal-store";
import { createLocalCoachStream } from "@/lib/local-coach";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(5000),
  })).max(30),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid local coach request." }, { status: 400 });
  }

  const journal = await readJournal();
  const system = `You are SwingScanner's private local trading journal reflection coach.
Use only the supplied journal evidence. Help the trader process decisions, emotions, habits, and lessons.

Required behavior:
- Separate process quality from outcome quality.
- Identify repeated patterns only when the evidence supports them.
- Ask precise reflective questions.
- Suggest one or two measurable process experiments.
- Be candid, concise, non-judgmental, and practical.
- State when the sample is too small.

Boundaries:
- Do not predict prices or recommend securities, entries, exits, position sizes, or buy/sell actions.
- Do not claim to be a financial adviser or therapist.
- Never invent journal facts.

Journal data:
${JSON.stringify(journal.slice(0, 100))}`;

  try {
    const { model, stream } = await createLocalCoachStream(
      system,
      parsed.data.messages,
      request.signal,
    );
    return new Response(stream, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-local-model": model,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local Ollama is not running.";
    return Response.json({ error: message }, { status: 503 });
  }
}
