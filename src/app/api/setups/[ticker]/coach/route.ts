import { z } from "zod";
import { createLocalCoachStream } from "@/lib/local-coach";
import { getSetupDetail } from "@/lib/setup-detail";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(5000),
  })).max(30),
});

export async function POST(request: Request, context: { params: Promise<{ ticker: string }> }) {
  const ticker = (await context.params).ticker.toUpperCase();
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid setup question." }, { status: 400 });
  const detail = await getSetupDetail(ticker);
  if (!detail) return Response.json({ error: "Setup not found in the latest scan." }, { status: 404 });

  const recentCandles = detail.candles.slice(-10).map(({ date, open, high, low, close, volume, ema8, ema21, ema50 }) => ({
    d: date,
    o: Number(open.toFixed(2)),
    h: Number(high.toFixed(2)),
    l: Number(low.toFixed(2)),
    c: Number(close.toFixed(2)),
    v: volume,
    e8: ema8 == null ? null : Number(ema8.toFixed(2)),
    e21: ema21 == null ? null : Number(ema21.toFixed(2)),
    e50: ema50 == null ? null : Number(ema50.toFixed(2)),
  }));
  const system = `You are SwingScanner's local setup analyst.
Answer only from the supplied completed-daily scan evidence. Explain the setup clearly and help the trader evaluate the written plan.

Required behavior:
- Distinguish observed facts from interpretation.
- Treat the setup as a completed-daily and aggregated-weekly structure.
- Supported structures are breakouts, 8-week EMA bounces, 8-week EMA reclaims, leader pullbacks, tight bases, undercut-and-reclaims, and extended leaders waiting for a reset.
- Lead with market leadership, canonical theme strength, peer participation, weekly 8/21 EMA structure, then the daily trigger and tradability.
- Refer to the score cap and cap reasons when they limit the ranking.
- Explain what would confirm or invalidate the thesis.
- Never describe an intraday pivot as the detected setup. State that intraday execution data and earnings information are unavailable.
- Discuss options only from the supplied IV, spread, open-interest, volume, and tradability fields.
- Do not say a trigger makes a bounce or breakout likely. A trigger is a condition to observe, not a prediction.
- Be concise and candid.

Boundaries:
- Do not claim certainty or invent live prices.
- Do not issue personalized buy/sell instructions or position sizing.
- Remind the user that execution requires a live broker feed when relevant.

Setup evidence:
${JSON.stringify({
  ticker: detail.setup.ticker,
  company: detail.setup.company,
  marketDate: detail.marketDate,
  setup: detail.setup.setup,
  setupLabel: detail.setup.setupLabel,
  canonicalTheme: detail.setup.canonicalTheme,
  matchedSetups: detail.setup.matchedSetups,
  status: detail.setup.status,
  score: detail.setup.finalScore,
  grade: detail.setup.grade,
  price: detail.setup.price,
  dayChangePercent: detail.setup.change,
  adrPercent: detail.setup.adr,
  relativeVolume: detail.setup.relativeVolume,
  rsi: detail.setup.rsi,
  relativeStrength: detail.setup.rs,
  relative5Spy: detail.setup.relative5Spy,
  relative5Qqq: detail.setup.relative5Qqq,
  relative20Spy: detail.setup.relative20Spy,
  relative20Qqq: detail.setup.relative20Qqq,
  relative63Spy: detail.setup.relative63Spy,
  relative63Qqq: detail.setup.relative63Qqq,
  weekEma8: detail.setup.weekEma8,
  weekEma21: detail.setup.weekEma21,
  distanceWeek8Percent: detail.setup.distanceWeek8,
  weeklyTrendHealthy: detail.setup.weeklyTrendHealthy,
  themeScore: detail.setup.themeScore,
  peerStrengthCount: detail.setup.peerStrengthCount,
  scoreCap: detail.setup.scoreCap,
  capReasons: detail.setup.capReasons,
  distance8Percent: detail.setup.distance8,
  distance21Percent: detail.setup.distance21,
  distance50Percent: detail.setup.distance50,
  extension: detail.setup.extension,
  sector: detail.setup.sector,
  sectorTicker: detail.setup.sectorTicker,
  industryTheme: detail.setup.theme,
  optionsAvailable: detail.setup.optionsAvailable,
  optionExpiration: detail.setup.optionExpiration,
  optionDte: detail.setup.optionDte,
  optionIv: detail.setup.optionIv,
  optionSpreadDollars: detail.setup.optionSpreadDollars,
  optionSpreadPercent: detail.setup.optionSpreadPct,
  optionOpenInterest: detail.setup.optionOpenInterest,
  optionVolume: detail.setup.optionVolume,
  optionsTradabilityScore: detail.setup.optionsTradabilityScore,
  tighteningPercent: detail.setup.tighteningPercent ?? detail.setup.plan.tighteningPercent,
  plan: detail.setup.plan,
  reasons: detail.setup.reasons,
  warnings: detail.setup.warnings,
  recentCandles,
})}`;

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
        "x-setup-coach-provider": "local-ollama",
        "x-setup-coach-model": model,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Local Ollama is not running.";
    return Response.json({ error: message }, { status: 503 });
  }
}
